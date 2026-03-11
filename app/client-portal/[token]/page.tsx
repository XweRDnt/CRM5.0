"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KinescopePlayer, type KinescopePlayerRef } from "@/components/video/KinescopePlayer";
import { cn } from "@/lib/utils/cn";
import { getMessages } from "@/lib/i18n/messages";
import { formatTimecode } from "@/lib/utils/time";
import type { AnnotationData, AnnotationShape } from "@/types";

const SUBMIT_TIMEOUT_MS = 15000;

type PortalVersion = {
  id: string;
  versionNumber: number;
  fileUrl: string;
  fileName: string;
  videoProvider: "KINESCOPE" | "EXTERNAL_URL" | "YOUTUBE_LEGACY";
  kinescopeVideoId: string | null;
  streamUrl: string | null;
  processingStatus: "UPLOADING" | "PROCESSING" | "READY" | "FAILED";
  durationSec: number | null;
  status: string;
  createdAt: string;
};

type PortalFeedbackItem = {
  id: string;
  text: string;
  timecodeSec: number | null;
  annotationData?: AnnotationData | null;
  createdAt: string;
  authorName: string;
  authorEmail: string | null;
};

type PortalResponse = {
  project: {
    id: string;
    name: string;
    clientName: string;
    companyName: string;
  };
  activeVersionId: string | null;
  versions: PortalVersion[];
  feedback: PortalFeedbackItem[];
};

type DrawingState = {
  tool: "rect" | "arrow";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

type PendingText = {
  x: number;
  y: number;
  value: string;
};

const fetcher = async (url: string): Promise<PortalResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Failed to load client portal");
  }
  return (await response.json()) as PortalResponse;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const isValidAnnotationData = (value: unknown): value is AnnotationData => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const data = value as AnnotationData;
  return data.version === 1 && Array.isArray(data.shapes);
};

export default function ClientPortalPage(): JSX.Element {
  const m = getMessages();
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = params.token;
  const requestedVersionId = searchParams.get("versionId") ?? undefined;

  const portalUrl = requestedVersionId
    ? `/api/public/portal/${token}?versionId=${encodeURIComponent(requestedVersionId)}`
    : `/api/public/portal/${token}`;

  const { data, isLoading, error, mutate } = useSWR(portalUrl, fetcher);
  const activeVersion = useMemo(
    () => data?.versions.find((version) => version.id === data.activeVersionId) ?? null,
    [data],
  );

  const kinescopeRef = useRef<KinescopePlayerRef | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastKnownTimeRef = useRef(0);
  const [playerCurrentTimeSec, setPlayerCurrentTimeSec] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [capturedTimecodeSec, setCapturedTimecodeSec] = useState<number | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [annotationTool, setAnnotationTool] = useState<"rect" | "arrow" | "text">("rect");
  const [annotationShapes, setAnnotationShapes] = useState<AnnotationShape[]>([]);
  const [activeAnnotation, setActiveAnnotation] = useState<AnnotationData | null>(null);
  const [drawingState, setDrawingState] = useState<DrawingState | null>(null);
  const [pendingText, setPendingText] = useState<PendingText | null>(null);

  const safeVideoUrl = (activeVersion?.streamUrl ?? activeVersion?.fileUrl ?? "").trim();
  const isVersionLocked = activeVersion?.status === "APPROVED" || activeVersion?.status === "FINAL";

  const updatePlayerTime = (seconds: number): void => {
    const normalized = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    lastKnownTimeRef.current = normalized;
    setPlayerCurrentTimeSec(normalized);
  };

  const readKinescopeTimeSafe = useCallback(async (): Promise<number> => {
    const player = kinescopeRef.current;
    if (!player) {
      return 0;
    }

    if (typeof player.getCurrentTimeAsync === "function") {
      const asyncTime = await player.getCurrentTimeAsync().catch(() => 0);
      if (Number.isFinite(asyncTime) && asyncTime > 0) {
        return asyncTime;
      }
    }

    return player.getCurrentTime();
  }, []);

  useEffect(() => {
    setPlayerReady(false);
    setPlayerCurrentTimeSec(0);
    setCapturedTimecodeSec(null);
    lastKnownTimeRef.current = 0;
    setAnnotationMode(false);
    setAnnotationShapes([]);
    setActiveAnnotation(null);
    setDrawingState(null);
    setPendingText(null);
  }, [activeVersion?.id, safeVideoUrl, activeVersion?.kinescopeVideoId]);

  useEffect(() => {
    if (!playerReady || !activeVersion) {
      return;
    }

    const interval = window.setInterval(() => {
      void (async () => {
        try {
          const next = await readKinescopeTimeSafe();
          updatePlayerTime(next);
        } catch {
          updatePlayerTime(0);
        }
      })();
    }, 250);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeVersion, playerReady, readKinescopeTimeSafe]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#1a1a1a] px-4 py-6 text-white">
        <div className="mx-auto h-40 max-w-5xl animate-pulse rounded-2xl bg-[#111111]" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-[#1a1a1a] px-4 py-6 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#111111] p-6">
          <h1 className="text-xl font-semibold">{m.portal.title}</h1>
          <p className="mt-3 text-sm text-red-400">{error instanceof Error ? error.message : "Portal unavailable"}</p>
        </div>
      </main>
    );
  }

  const selectVersion = (versionId: string): void => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("versionId", versionId);
    router.replace(`/client-portal/${token}?${params.toString()}`);
  };

  const startAnnotationMode = async (): Promise<void> => {
    if (!activeVersion) {
      toast.error("Version not found");
      return;
    }

    if (!playerReady) {
      toast.error(m.portal.playerNotReady);
      return;
    }

    kinescopeRef.current?.pause();

    const kinescopeTime = await readKinescopeTimeSafe();
    const directTime = Math.max(0, Math.floor(Number.isFinite(kinescopeTime) ? kinescopeTime : 0));
    const normalized = Math.max(directTime, lastKnownTimeRef.current, playerCurrentTimeSec);
    if (normalized === 0) {
      toast.error(m.portal.playBeforeCapture);
      return;
    }

    setCapturedTimecodeSec(normalized);
    setAnnotationMode(true);
    setAnnotationShapes([]);
    setActiveAnnotation(null);
    setDrawingState(null);
    setPendingText(null);
  };

  const getOverlayPoint = (event: React.PointerEvent): { x: number; y: number } | null => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) {
      return null;
    }
    const x = clamp01((event.clientX - rect.left) / rect.width);
    const y = clamp01((event.clientY - rect.top) / rect.height);
    return { x, y };
  };

  const finalizeShape = (state: DrawingState): void => {
    const dx = state.endX - state.startX;
    const dy = state.endY - state.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 0.01) {
      setDrawingState(null);
      return;
    }

    if (state.tool === "rect") {
      const x = Math.min(state.startX, state.endX);
      const y = Math.min(state.startY, state.endY);
      const w = Math.abs(dx);
      const h = Math.abs(dy);
      if (w < 0.01 || h < 0.01) {
        setDrawingState(null);
        return;
      }
      setAnnotationShapes((prev) => [...prev, { type: "rect", x, y, w, h }]);
    } else {
      setAnnotationShapes((prev) => [
        ...prev,
        { type: "arrow", x1: state.startX, y1: state.startY, x2: state.endX, y2: state.endY },
      ]);
    }

    setDrawingState(null);
    window.setTimeout(() => textAreaRef.current?.focus(), 0);
  };

  const handlePointerDown = (event: React.PointerEvent): void => {
    if (!annotationMode || annotationTool === "text") {
      return;
    }
    const point = getOverlayPoint(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    setDrawingState({ tool: annotationTool, startX: point.x, startY: point.y, endX: point.x, endY: point.y });
  };

  const handlePointerMove = (event: React.PointerEvent): void => {
    if (!drawingState) {
      return;
    }
    const point = getOverlayPoint(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    setDrawingState((prev) => (prev ? { ...prev, endX: point.x, endY: point.y } : prev));
  };

  const handlePointerUp = (event: React.PointerEvent): void => {
    if (!drawingState) {
      return;
    }
    const point = getOverlayPoint(event);
    if (!point) {
      setDrawingState(null);
      return;
    }
    event.preventDefault();
    finalizeShape({ ...drawingState, endX: point.x, endY: point.y });
  };

  const handleOverlayClick = (event: React.PointerEvent): void => {
    if (!annotationMode || annotationTool !== "text") {
      return;
    }
    const point = getOverlayPoint(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    setPendingText({ x: point.x, y: point.y, value: "" });
  };

  const confirmTextShape = (): void => {
    if (!pendingText) {
      return;
    }
    const trimmed = pendingText.value.trim();
    if (trimmed) {
      setAnnotationShapes((prev) => [...prev, { type: "text", x: pendingText.x, y: pendingText.y, text: trimmed }]);
      window.setTimeout(() => textAreaRef.current?.focus(), 0);
    }
    setPendingText(null);
  };

  const seekToTimecode = (timecodeSec: number | null, annotation: PortalFeedbackItem["annotationData"]): void => {
    const target = Number.isFinite(timecodeSec) ? Math.max(0, timecodeSec as number) : 0;
    kinescopeRef.current?.seekTo(target);
    kinescopeRef.current?.pause();

    if (annotation && isValidAnnotationData(annotation)) {
      setActiveAnnotation(annotation);
    } else {
      setActiveAnnotation(null);
    }
    setAnnotationMode(false);
  };

  const approveVersion = async (): Promise<void> => {
    if (!activeVersion) {
      return;
    }

    setApproving(true);

    try {
      const response = await fetch(`/api/public/portal/${token}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: activeVersion.id }),
      });
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(json?.error || m.portal.approveFailed);
      }
      setApproveDialogOpen(false);
      toast.success(m.portal.approvedSuccess);
      await mutate();
    } catch (approveError) {
      toast.error(approveError instanceof Error ? approveError.message : m.portal.approveFailed);
    } finally {
      setApproving(false);
    }
  };

  const submitFeedback = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!activeVersion) {
      return;
    }

    setSubmitting(true);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
    const payload: Record<string, unknown> = {
      assetVersionId: activeVersion.id,
      authorType: "CLIENT",
      authorName: "Client",
      text: commentText,
      timecodeSec: capturedTimecodeSec ?? undefined,
    };

    if (annotationShapes.length > 0) {
      payload.annotationData = { version: 1, shapes: annotationShapes } satisfies AnnotationData;
    }

    try {
      const response = await fetch("/api/public/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error || "Failed to submit feedback");
      }

      setCommentText("");
      setCapturedTimecodeSec(null);
      setAnnotationMode(false);
      setAnnotationShapes([]);
      setActiveAnnotation(null);
      setDrawingState(null);
      setPendingText(null);
      toast.success(m.feedback.submitSuccess);
      await mutate();
    } catch (submitError) {
      const errorName =
        typeof submitError === "object" && submitError !== null && "name" in submitError
          ? String((submitError as { name?: unknown }).name)
          : "";
      const isAbort = errorName === "AbortError";
      if (isAbort) {
        toast.error("Request timeout. Please try again.");
      } else {
        toast.error(submitError instanceof Error ? submitError.message : m.feedback.submitError);
      }
    } finally {
      window.clearTimeout(timeout);
      setSubmitting(false);
    }
  };

  const overlayVisible = annotationMode || activeAnnotation !== null;
  const overlayAnnotation = annotationMode ? { version: 1, shapes: annotationShapes } : activeAnnotation;
  const previewShape = drawingState;

  const renderShape = (shape: AnnotationShape, index: number): JSX.Element | null => {
    switch (shape.type) {
      case "rect":
        return (
          <rect
            key={`rect-${index}`}
            x={shape.x}
            y={shape.y}
            width={shape.w}
            height={shape.h}
            fill="rgba(16, 185, 129, 0.12)"
            stroke="#10b981"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        );
      case "arrow":
        return (
          <line
            key={`arrow-${index}`}
            x1={shape.x1}
            y1={shape.y1}
            x2={shape.x2}
            y2={shape.y2}
            stroke="#38bdf8"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            markerEnd="url(#arrowhead)"
          />
        );
      case "text":
        return (
          <text key={`text-${index}`} x={shape.x} y={shape.y} fill="#f8fafc" fontSize="0.04" fontWeight={600}>
            {shape.text}
          </text>
        );
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen bg-[#1a1a1a] text-white">
      <header className="sticky top-0 z-30 h-12 border-b border-white/10 bg-[#111111]">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">{data.project.name}</span>
            <span className="text-xs text-white/60">Версия {activeVersion?.versionNumber ?? "—"}</span>
          </div>
          <Button
            onClick={() => setApproveDialogOpen(true)}
            disabled={isVersionLocked || !activeVersion}
            className={cn(
              "h-8 rounded-full px-4 text-xs font-semibold",
              isVersionLocked
                ? "bg-white/10 text-white/50"
                : "bg-emerald-500 text-white hover:bg-emerald-400",
            )}
          >
            {isVersionLocked ? m.portal.approved : "Утвердить версию"}
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-6 pt-4 lg:min-h-[calc(100vh-3rem)] lg:flex-row">
        <section className="flex w-full flex-col gap-4 lg:w-[70%]">
          {data.versions.length > 1 ? (
            <div className="flex items-center gap-2 text-xs text-white/60">
              <span>Версия</span>
              <select
                value={activeVersion?.id ?? ""}
                onChange={(event) => selectVersion(event.target.value)}
                className="rounded-md border border-white/10 bg-[#111111] px-2 py-1 text-xs text-white"
              >
                {data.versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    V{version.versionNumber}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
            <KinescopePlayer
              ref={kinescopeRef}
              className="w-full"
              videoId={activeVersion?.kinescopeVideoId}
              videoUrl={safeVideoUrl}
              onReady={() => setPlayerReady(true)}
              onTimeUpdate={(seconds) => updatePlayerTime(seconds)}
              onPlay={() => {
                setPlayerReady(true);
                if (!annotationMode) {
                  setActiveAnnotation(null);
                }
              }}
            />

            <div
              ref={overlayRef}
              className={cn("absolute inset-0 z-20", overlayVisible ? "pointer-events-auto" : "pointer-events-none")}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={() => drawingState && setDrawingState(null)}
              onPointerCancel={() => drawingState && setDrawingState(null)}
              onClick={handleOverlayClick}
            >
              {overlayVisible ? (
                <svg viewBox="0 0 1 1" className="h-full w-full">
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="6"
                      markerHeight="6"
                      refX="5"
                      refY="3"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <path d="M0,0 L6,3 L0,6 Z" fill="#38bdf8" />
                    </marker>
                  </defs>
                  {overlayAnnotation?.shapes.map((shape, index) => renderShape(shape, index))}
                  {previewShape?.tool === "arrow" ? (
                    <line
                      x1={previewShape.startX}
                      y1={previewShape.startY}
                      x2={previewShape.endX}
                      y2={previewShape.endY}
                      stroke="#38bdf8"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                  {previewShape?.tool === "rect" ? (
                    <rect
                      x={Math.min(previewShape.startX, previewShape.endX)}
                      y={Math.min(previewShape.startY, previewShape.endY)}
                      width={Math.abs(previewShape.endX - previewShape.startX)}
                      height={Math.abs(previewShape.endY - previewShape.startY)}
                      fill="rgba(16, 185, 129, 0.12)"
                      stroke="#10b981"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                </svg>
              ) : null}

              {annotationMode ? (
                <div className="absolute left-3 top-3 z-30 flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-xs">
                  {([
                    { key: "arrow", label: "Стрелка" },
                    { key: "rect", label: "Прямоуг" },
                    { key: "text", label: "Текст" },
                  ] as const).map((tool) => (
                    <button
                      key={tool.key}
                      type="button"
                      onClick={() => setAnnotationTool(tool.key)}
                      className={cn(
                        "rounded-full px-3 py-1 text-[11px] font-semibold",
                        annotationTool === tool.key
                          ? "bg-white text-black"
                          : "bg-white/10 text-white/70 hover:text-white",
                      )}
                    >
                      {tool.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {annotationMode ? (
                <button
                  type="button"
                  onClick={() => {
                    setAnnotationMode(false);
                    setAnnotationShapes([]);
                    setDrawingState(null);
                    setPendingText(null);
                  }}
                  className="absolute right-3 top-3 z-30 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-xs text-white/80 hover:text-white"
                >
                  Отменить
                </button>
              ) : activeAnnotation ? (
                <button
                  type="button"
                  onClick={() => setActiveAnnotation(null)}
                  className="absolute right-3 top-3 z-30 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-xs text-white/80 hover:text-white"
                >
                  Скрыть
                </button>
              ) : null}

              {pendingText && annotationMode ? (
                <div
                  className="absolute z-40 rounded-md border border-white/10 bg-black/80 p-2"
                  style={{ left: `${pendingText.x * 100}%`, top: `${pendingText.y * 100}%` }}
                >
                  <input
                    autoFocus
                    value={pendingText.value}
                    onChange={(event) => setPendingText({ ...pendingText, value: event.target.value })}
                    onBlur={confirmTextShape}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        confirmTextShape();
                      }
                      if (event.key === "Escape") {
                        setPendingText(null);
                      }
                    }}
                    placeholder="Текст"
                    className="w-40 rounded bg-black/60 px-2 py-1 text-xs text-white outline-none"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#111111] px-4 py-3">
            <div className="text-sm text-white/70">
              Текущее время: <span className="font-semibold text-white">{formatTimecode(playerCurrentTimeSec)}</span>
              {capturedTimecodeSec !== null ? (
                <span className="ml-2 text-xs text-emerald-400">Выбрано: {formatTimecode(capturedTimecodeSec)}</span>
              ) : null}
            </div>
            <Button
              onClick={startAnnotationMode}
              type="button"
              disabled={!playerReady || isVersionLocked}
              className="h-9 rounded-full bg-[#007AFF] px-4 text-xs font-semibold text-white hover:bg-[#0A84FF]"
            >
              Добавить правку
            </Button>
          </div>

          {activeVersion?.processingStatus !== "READY" ? (
            <p className="text-xs text-white/50">
              {activeVersion.processingStatus === "FAILED"
                ? "Kinescope processing failed for this version."
                : "Kinescope is still processing this video. Playback may be temporarily unavailable."}
            </p>
          ) : null}
          {isVersionLocked && <p className="text-xs text-white/40">{m.portal.approvalLocked}</p>}
        </section>

        <aside className="flex w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111111] lg:h-[calc(100vh-4.5rem)] lg:w-[30%]">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            <div className="text-sm font-semibold text-white/80">Комментарии</div>
            {data.feedback.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-white/50">
                Правок пока нет
              </div>
            ) : (
              data.feedback
                .filter((item) => !["Ping from debug", "Ping after queue fix", "Smoke after direct route"].includes(item.text))
                .map((item) => (
                  <article key={item.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white/80">{item.authorName}</span>
                      <button
                        type="button"
                        onClick={() => seekToTimecode(item.timecodeSec, item.annotationData)}
                        className="rounded-full bg-blue-500/10 px-2 py-1 text-[11px] font-semibold text-blue-300 hover:text-blue-200"
                      >
                        {item.timecodeSec !== null ? formatTimecode(item.timecodeSec) : "Без таймкода"}
                      </button>
                    </div>
                    <p className="text-sm leading-relaxed text-white/80">{item.text}</p>
                  </article>
                ))
            )}
          </div>

          <form onSubmit={submitFeedback} className="border-t border-white/10 bg-black/40 p-4">
            <label className="mb-2 block text-xs text-white/60">Добавить правку</label>
            <textarea
              ref={textAreaRef}
              rows={4}
              required
              disabled={isVersionLocked}
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder="Опишите правку..."
              className="mb-3 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
            <Button
              type="submit"
              disabled={submitting || isVersionLocked || commentText.trim().length === 0}
              className="w-full rounded-full bg-white text-sm font-semibold text-black hover:bg-white/90"
            >
              {submitting ? m.feedback.submitting : "Отправить"}
            </Button>
          </form>
        </aside>
      </div>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.portal.approveDialogTitle}</DialogTitle>
            <DialogDescription>{m.portal.approveDialogDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)} disabled={approving}>
              {m.portal.cancel}
            </Button>
            <Button onClick={approveVersion} disabled={approving || !activeVersion}>
              {approving ? "..." : m.portal.approveConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

