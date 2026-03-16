"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KinescopePlayer, type KinescopePlayerRef } from "@/components/video/KinescopePlayer";
import { cn } from "@/lib/utils/cn";
import { getMessages } from "@/lib/i18n/messages";
import { formatTimecode } from "@/lib/utils/time";
import { strokeToSvg } from "@/lib/annotations/render";
import { validateAnnotationData } from "@/lib/annotations/validation";
import { getOverlaySvgProps } from "@/lib/annotations/svg";
import { normalizeClientPoint } from "@/lib/annotations/coords";
import { getAnnotationToggle, stopAnnotationToolbarEvent } from "@/lib/annotations/interaction";
import { getDrawingSurfaceClass } from "@/lib/annotations/overlay";
import type { AnnotationColor, AnnotationData, AnnotationStroke, AnnotationThickness, AnnotationType } from "@/types";
import { ArrowUpRight, Circle, Minus, Pencil, Redo2, Send, Square, Type, Undo2, X } from "lucide-react";

const SUBMIT_TIMEOUT_MS = 15000;

type PortalVersion = {
  id: string;
  versionNumber: number;
  fileUrl: string;
  fileName: string;
  videoProvider: "KINESCOPE";
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
  annotationPreview?: string | null;
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

type AnnotationTool = AnnotationType;

type DrawingState = {
  tool: AnnotationTool;
  points: Array<{ x: number; y: number }>;
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

const isValidAnnotationData = (value: unknown): value is AnnotationData => {
  const result = validateAnnotationData(value);
  return result.ok;
};

const normalizeAnnotationData = (value: unknown): AnnotationData | null => {
  if (isValidAnnotationData(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const legacy = value as { version?: number; shapes?: Array<Record<string, unknown>> };
  if (legacy.version !== 1 || !Array.isArray(legacy.shapes)) {
    return null;
  }

  const strokes: AnnotationStroke[] = [];
  for (const shape of legacy.shapes) {
    if (shape.type === "rect") {
      const x = Number(shape.x);
      const y = Number(shape.y);
      const w = Number(shape.w);
      const h = Number(shape.h);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(h)) {
        strokes.push({
          type: "rect",
          points: [
            { x, y },
            { x: x + w, y: y + h },
          ],
          color: "green",
          thickness: "medium",
        });
      }
    }
    if (shape.type === "arrow") {
      const x1 = Number(shape.x1);
      const y1 = Number(shape.y1);
      const x2 = Number(shape.x2);
      const y2 = Number(shape.y2);
      if (Number.isFinite(x1) && Number.isFinite(y1) && Number.isFinite(x2) && Number.isFinite(y2)) {
        strokes.push({
          type: "arrow",
          points: [
            { x: x1, y: y1 },
            { x: x2, y: y2 },
          ],
          color: "blue",
          thickness: "medium",
        });
      }
    }
    if (shape.type === "text") {
      const x = Number(shape.x);
      const y = Number(shape.y);
      const text = typeof shape.text === "string" ? shape.text : "";
      if (Number.isFinite(x) && Number.isFinite(y) && text.trim().length > 0) {
        strokes.push({
          type: "text",
          points: [{ x, y }],
          text,
          color: "white",
          thickness: "medium",
        });
      }
    }
  }

  if (strokes.length === 0) {
    return null;
  }

  return { version: 1, strokes };
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
  const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
  const [capturedTimecodeSec, setCapturedTimecodeSec] = useState<number | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [authorName, setAuthorName] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return localStorage.getItem("portal_author_name") ?? "";
  });
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>("rect");
  const [annotationColor, setAnnotationColor] = useState<AnnotationColor>("red");
  const [annotationThickness, setAnnotationThickness] = useState<AnnotationThickness>("medium");
  const [annotationStrokes, setAnnotationStrokes] = useState<AnnotationStroke[]>([]);
  const [redoStrokes, setRedoStrokes] = useState<AnnotationStroke[]>([]);
  const [activeAnnotation, setActiveAnnotation] = useState<AnnotationData | null>(null);
  const [drawingState, setDrawingState] = useState<DrawingState | null>(null);
  const [pendingText, setPendingText] = useState<PendingText | null>(null);
  const debugAnnotations = searchParams.get("debugAnnotations") === "1";
  const blurActiveElement = (): void => {
    if (typeof document === "undefined") {
      return;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
  };
  const handleToolbarEvent = (event: React.SyntheticEvent): void => {
    blurActiveElement();
    stopAnnotationToolbarEvent(event);
  };

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
    setAnnotationStrokes([]);
    setRedoStrokes([]);
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

  useEffect(() => {
    if (authorName) {
      localStorage.setItem("portal_author_name", authorName);
    }
  }, [authorName]);

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

    blurActiveElement();
    kinescopeRef.current?.pause();

    const kinescopeTime = await readKinescopeTimeSafe();
    const directTime = Math.max(0, Math.floor(Number.isFinite(kinescopeTime) ? kinescopeTime : 0));
    const normalized = Math.max(directTime, lastKnownTimeRef.current, playerCurrentTimeSec);
    setCapturedTimecodeSec(normalized);
    setAnnotationMode(true);
    setAnnotationStrokes([]);
    setRedoStrokes([]);
    setActiveAnnotation(null);
    setDrawingState(null);
    setPendingText(null);
  };

  const stopAnnotationMode = (): void => {
    setAnnotationMode(false);
    setDrawingState(null);
    setPendingText(null);
  };

  const toggleAnnotationMode = (): void => {
    const toggle = getAnnotationToggle(annotationMode);
    if (toggle.nextEnabled) {
      void startAnnotationMode();
      return;
    }
    stopAnnotationMode();
  };

  const getOverlayPoint = (event: React.PointerEvent | React.MouseEvent<HTMLDivElement>): { x: number; y: number } | null => {
    const rect = overlayRef.current?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
    const normalized = normalizeClientPoint(event.clientX, event.clientY, rect);
    if (debugAnnotations) {
      const overlayParent = overlayRef.current?.parentElement ?? null;
      const videoElement = overlayParent?.querySelector("iframe, video") as HTMLElement | null;
      const videoRect = videoElement?.getBoundingClientRect() ?? null;
      const targetElement = event.target instanceof HTMLElement ? event.target : null;
      const currentTargetElement = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
      const targetRect = targetElement?.getBoundingClientRect() ?? null;
      const currentTargetRect = currentTargetElement?.getBoundingClientRect() ?? null;
      console.log("[annotations] pointer", {
        clientX: event.clientX,
        clientY: event.clientY,
        pageX: "pageX" in event ? event.pageX : undefined,
        pageY: "pageY" in event ? event.pageY : undefined,
        offsetX: "offsetX" in event ? event.offsetX : undefined,
        offsetY: "offsetY" in event ? event.offsetY : undefined,
        target: targetElement
          ? {
              tag: targetElement.tagName,
              id: targetElement.id,
              className: targetElement.className,
            }
          : null,
        currentTarget: currentTargetElement
          ? {
              tag: currentTargetElement.tagName,
              id: currentTargetElement.id,
              className: currentTargetElement.className,
            }
          : null,
        rect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
        targetRect: targetRect
          ? {
              left: targetRect.left,
              top: targetRect.top,
              width: targetRect.width,
              height: targetRect.height,
            }
          : null,
        currentTargetRect: currentTargetRect
          ? {
              left: currentTargetRect.left,
              top: currentTargetRect.top,
              width: currentTargetRect.width,
              height: currentTargetRect.height,
            }
          : null,
        overlayPointerEvents: overlayRef.current
          ? window.getComputedStyle(overlayRef.current).pointerEvents
          : null,
        videoRect: videoRect
          ? {
              left: videoRect.left,
              top: videoRect.top,
              width: videoRect.width,
              height: videoRect.height,
            }
          : null,
        scroll: {
          x: window.scrollX,
          y: window.scrollY,
        },
        devicePixelRatio: window.devicePixelRatio,
        normalized,
      });
    }
    return normalized;
  };

  const pushStroke = (stroke: AnnotationStroke): void => {
    setAnnotationStrokes((prev) => [...prev, stroke]);
    setRedoStrokes([]);
    if (!annotationMode) {
      window.setTimeout(() => textAreaRef.current?.focus(), 0);
    }
  };

  const buildStrokeFromState = (state: DrawingState): AnnotationStroke | null => {
    if (state.tool === "text") {
      return null;
    }

    if (state.tool === "freehand") {
      if (state.points.length < 2) {
        return null;
      }
      return {
        type: "freehand",
        points: state.points,
        color: annotationColor,
        thickness: annotationThickness,
      };
    }

    if (state.points.length < 2) {
      return null;
    }

    const [start, end] = state.points;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 0.01) {
      return null;
    }

    if ((state.tool === "rect" || state.tool === "ellipse") && (Math.abs(dx) < 0.01 || Math.abs(dy) < 0.01)) {
      return null;
    }

    return {
      type: state.tool,
      points: [start, end],
      color: annotationColor,
      thickness: annotationThickness,
    };
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
    if (annotationTool === "freehand") {
      setDrawingState({ tool: annotationTool, points: [point] });
      return;
    }
    setDrawingState({ tool: annotationTool, points: [point, point] });
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
    setDrawingState((prev) => {
      if (!prev) {
        return prev;
      }
      if (prev.tool === "freehand") {
        return { ...prev, points: [...prev.points, point] };
      }
      const nextPoints = [...prev.points];
      nextPoints[1] = point;
      return { ...prev, points: nextPoints };
    });
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
    const finalized =
      drawingState.tool === "freehand"
        ? { ...drawingState, points: [...drawingState.points, point] }
        : { ...drawingState, points: [drawingState.points[0], point] };
    const stroke = buildStrokeFromState(finalized);
    if (stroke) {
      pushStroke(stroke);
    }
    setDrawingState(null);
  };

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>): void => {
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
      pushStroke({
        type: "text",
        points: [{ x: pendingText.x, y: pendingText.y }],
        text: trimmed,
        color: annotationColor,
        thickness: annotationThickness,
      });
    }
    setPendingText(null);
  };

  const handleUndo = (): void => {
    setAnnotationStrokes((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const next = prev.slice(0, -1);
      const last = prev[prev.length - 1];
      setRedoStrokes((redo) => [last, ...redo]);
      return next;
    });
  };

  const handleRedo = (): void => {
    setRedoStrokes((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const [nextStroke, ...rest] = prev;
      setAnnotationStrokes((strokes) => [...strokes, nextStroke]);
      return rest;
    });
  };

  const seekToTimecode = (timecodeSec: number | null, annotation: PortalFeedbackItem["annotationData"]): void => {
    const target = Number.isFinite(timecodeSec) ? Math.max(0, timecodeSec as number) : 0;
    kinescopeRef.current?.seekTo(target);
    kinescopeRef.current?.pause();

    const normalized = normalizeAnnotationData(annotation);
    setActiveAnnotation(normalized);
    setIsPlayerPlaying(false);
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

  const submitFeedback = async (event?: React.FormEvent): Promise<void> => {
    event?.preventDefault();
    if (!activeVersion) {
      return;
    }

    setSubmitting(true);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
    const trimmedAuthor = authorName.trim();
    const trimmedText = commentText.trim();
    const payload: Record<string, unknown> = {
      assetVersionId: activeVersion.id,
      authorType: "CLIENT",
      authorName: trimmedAuthor,
      text: trimmedText,
      timecodeSec: capturedTimecodeSec ?? undefined,
    };

    if (annotationStrokes.length > 0) {
      payload.annotationData = { version: 1, strokes: annotationStrokes } satisfies AnnotationData;
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
      setAnnotationStrokes([]);
      setRedoStrokes([]);
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

  const trimmedComment = commentText.trim();
  const trimmedAuthor = authorName.trim();
  const hasComment = trimmedComment.length > 0;
  const hasStrokes = annotationStrokes.length > 0;
  const canSubmit = !submitting && !isVersionLocked && trimmedAuthor.length > 0 && (hasComment || hasStrokes);
  const overlayVisible = annotationMode || activeAnnotation !== null;
  const previewStroke: AnnotationStroke | null = drawingState
    ? drawingState.tool === "freehand"
      ? {
          type: "freehand",
          points: drawingState.points,
          color: annotationColor,
          thickness: annotationThickness,
        }
      : drawingState.points.length >= 2
        ? {
            type: drawingState.tool,
            points: [drawingState.points[0], drawingState.points[1]],
            color: annotationColor,
            thickness: annotationThickness,
          }
        : null
    : null;

  const overlayStrokes = annotationMode
    ? [...annotationStrokes, ...(previewStroke ? [previewStroke] : [])]
    : activeAnnotation?.strokes ?? [];

  const renderStroke = (stroke: AnnotationStroke, index: number): JSX.Element => (
    <g key={`stroke-${index}`} dangerouslySetInnerHTML={{ __html: strokeToSvg(stroke) }} />
  );

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

          <div
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-black"
            onPointerDownCapture={blurActiveElement}
            onTouchStartCapture={blurActiveElement}
          >
            <KinescopePlayer
              ref={kinescopeRef}
              className="w-full"
              videoId={activeVersion?.kinescopeVideoId}
              videoUrl={safeVideoUrl}
              onReady={() => setPlayerReady(true)}
              onTimeUpdate={(seconds) => updatePlayerTime(seconds)}
              onPlay={() => {
                setPlayerReady(true);
                setIsPlayerPlaying(true);
                setActiveAnnotation(null);
              }}
              onPause={() => setIsPlayerPlaying(false)}
            />

            <div className="pointer-events-none absolute inset-0 z-20">
              <div
                ref={overlayRef}
                className={cn(getDrawingSurfaceClass(annotationMode), overlayVisible ? "" : "pointer-events-none")}
                style={annotationMode ? { touchAction: "none" } : undefined}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={() => drawingState && setDrawingState(null)}
                onPointerCancel={() => drawingState && setDrawingState(null)}
                onClick={handleOverlayClick}
              >
                {overlayVisible ? (
                  <svg {...getOverlaySvgProps()} className="h-full w-full">
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
                        <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
                      </marker>
                    </defs>
                    {overlayStrokes.map((stroke, index) => renderStroke(stroke, index))}
                  </svg>
                ) : null}
              </div>

              {/* Floating annotation widget */}
              <div
                className="pointer-events-auto absolute z-40"
                style={{
                  right: "0.75rem",
                  bottom: "calc(0.75rem + env(safe-area-inset-bottom))",
                }}
                onPointerDown={handleToolbarEvent}
                onPointerUp={handleToolbarEvent}
                onClick={handleToolbarEvent}
              >
                {/* Панель инструментов — видна только в annotationMode */}
                {annotationMode && (
                  <div className="mb-2 flex flex-col items-end gap-2">
                    {/* Инструменты */}
                    <div className="flex flex-wrap justify-end gap-1.5 rounded-2xl border border-white/10 bg-black/80 p-2 shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
                      {([
                        { key: "arrow", label: "Стрелка", icon: ArrowUpRight },
                        { key: "rect", label: "Прямоугольник", icon: Square },
                        { key: "ellipse", label: "Эллипс", icon: Circle },
                        { key: "line", label: "Линия", icon: Minus },
                        { key: "freehand", label: "Карандаш", icon: Pencil },
                        { key: "text", label: "Текст", icon: Type },
                      ] as const).map((tool) => {
                        const Icon = tool.icon;
                        return (
                          <button
                            key={tool.key}
                            type="button"
                            onClick={() => setAnnotationTool(tool.key)}
                            aria-label={tool.label}
                            title={tool.label}
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-full border text-[11px] font-semibold transition",
                              annotationTool === tool.key
                                ? "border-white/40 bg-white text-black"
                                : "border-white/10 bg-white/5 text-white/70 hover:text-white",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        );
                      })}
                    </div>

                    {/* Цвета + толщины + undo/redo */}
                    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/80 p-2 shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
                      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                        {([
                          { key: "red", label: "Красный", tone: "bg-red-500" },
                          { key: "yellow", label: "Жёлтый", tone: "bg-yellow-400" },
                          { key: "green", label: "Зелёный", tone: "bg-emerald-500" },
                          { key: "blue", label: "Синий", tone: "bg-blue-500" },
                          { key: "white", label: "Белый", tone: "bg-white" },
                        ] as const).map((color) => (
                          <button
                            key={color.key}
                            type="button"
                            onClick={() => setAnnotationColor(color.key)}
                            aria-label={color.label}
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-full border transition",
                              annotationColor === color.key
                                ? "border-white/50 bg-white/20"
                                : "border-white/10 bg-white/5",
                            )}
                          >
                            <span className={cn("h-2.5 w-2.5 rounded-full", color.tone)} />
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                        {([
                          { key: "thin", label: "S" },
                          { key: "medium", label: "M" },
                          { key: "thick", label: "L" },
                        ] as const).map((thickness) => (
                          <button
                            key={thickness.key}
                            type="button"
                            onClick={() => setAnnotationThickness(thickness.key)}
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold transition",
                              annotationThickness === thickness.key
                                ? "bg-white text-black"
                                : "bg-white/10 text-white/70 hover:text-white",
                            )}
                          >
                            {thickness.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleUndo}
                        disabled={annotationStrokes.length === 0}
                        aria-label="Undo"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:text-white disabled:opacity-30"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleRedo}
                        disabled={redoStrokes.length === 0}
                        aria-label="Redo"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:text-white disabled:opacity-30"
                      >
                        <Redo2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Отправить */}
                    <button
                      type="button"
                      onClick={() => void submitFeedback()}
                      disabled={!canSubmit}
                      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-40"
                    >
                      {submitting ? "Отправляю..." : "Отправить"}
                    </button>
                  </div>
                )}

                {/* Кружок-кнопка */}
                <button
                  type="button"
                  onClick={toggleAnnotationMode}
                  disabled={isVersionLocked || !playerReady}
                  aria-label={annotationMode ? "Закрыть рисование" : "Рисовать"}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full border shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition",
                    annotationMode
                      ? "border-white/40 bg-white text-black"
                      : "border-white/10 bg-black/70 text-white/70 hover:text-white",
                  )}
                >
                  {annotationMode ? <X className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
                </button>
              </div>

              {activeAnnotation ? (
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
              onClick={() => textAreaRef.current?.focus()}
              type="button"
              disabled={!playerReady || isVersionLocked}
              className="h-9 rounded-full bg-[#007AFF] px-4 text-xs font-semibold text-white hover:bg-[#0A84FF]"
            >
              Добавить правку
            </Button>
          </div>

          {activeVersion && activeVersion.processingStatus !== "READY" ? (
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
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="block text-xs text-white/60">Добавить правку</label>
            </div>
            <Input
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              placeholder="Ваше имя"
              required
              disabled={isVersionLocked}
              className="mb-3 h-9 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
            <textarea
              ref={textAreaRef}
              rows={4}
              disabled={isVersionLocked}
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder={hasStrokes ? "Комментарий (необязательно)" : "Опишите правку..."}
              className="mb-3 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
            <Button
              type="submit"
              disabled={!canSubmit}
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


