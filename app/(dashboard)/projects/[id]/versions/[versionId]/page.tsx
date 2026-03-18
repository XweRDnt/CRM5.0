"use client";

import useSWR from "swr";
import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronDown, Download, Loader2, Send } from "lucide-react";
import type { FeedbackStatus } from "@prisma/client";
import { KinescopePlayer, type KinescopePlayerRef } from "@/components/video/KinescopePlayer";
import { toast } from "@/components/ui/toast";
import { VersionUploadDialog } from "@/components/versions/VersionUploadDialog";
import { useAuthGuard } from "@/lib/hooks/use-auth-guard";
import { apiFetch } from "@/lib/utils/client-api";
import { cn } from "@/lib/utils/cn";
import { strokeToSvg } from "@/lib/annotations/render";
import { getOverlaySvgProps } from "@/lib/annotations/svg";
import { validateAnnotationData } from "@/lib/annotations/validation";
import { getAnnotationPlaybackPolicy } from "@/lib/annotations/behavior";
import { VERSION_STATUS_LABELS, toVersionUiStatus } from "@/lib/constants/status-ui";
import type { AnnotationData, AnnotationStroke, AssetVersionResponse, FeedbackResponse, ProjectResponse } from "@/types";

type ApiWrapped<T> = T | { data: T };
type FeedbackFilter = "all" | "NEW" | "VIEWED" | "IN_PROGRESS" | "RESOLVED";

const STATUS_BADGE_LABELS: Record<FeedbackStatus, string> = {
  NEW: "Новая",
  VIEWED: "Просмотрено",
  IN_PROGRESS: "В работе",
  RESOLVED: "Готово",
  REJECTED: "Отклонена",
};

const STATUS_BADGE_CLASSES: Record<FeedbackStatus, string> = {
  NEW: "border-amber-400/30 bg-amber-400/15 text-amber-200",
  VIEWED: "border-white/15 bg-white/8 text-white/55",
  IN_PROGRESS: "border-blue-400/30 bg-blue-400/15 text-blue-200",
  RESOLVED: "border-emerald-400/30 bg-emerald-400/15 text-emerald-200",
  REJECTED: "border-rose-400/30 bg-rose-400/15 text-rose-200",
};

const FILTER_LABELS: Record<FeedbackFilter, string> = {
  all: "Все",
  NEW: "Новые",
  VIEWED: "Просмотрено",
  IN_PROGRESS: "В работе",
  RESOLVED: "Готово",
};
function unwrap<T>(payload: ApiWrapped<T>): T {
  return "data" in (payload as { data?: T }) ? (payload as { data: T }).data : (payload as T);
}

function formatDate(value: Date): string {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTimecode(seconds: number | null): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds as number)) : 0;
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

const isValidAnnotationData = (value: unknown): value is AnnotationData => {
  return validateAnnotationData(value).ok;
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

function createPublicPortalLink(portalToken: string): string {
  if (typeof window === "undefined") {
    return `/client-portal/${portalToken}`;
  }

  return `${window.location.origin}/client-portal/${portalToken}`;
}

function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (!success) {
        reject(new Error("Clipboard copy failed"));
        return;
      }
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

export default function VersionDetailPage(): JSX.Element {
  const params = useParams<{ id: string; versionId: string }>();
  const { id: projectId, versionId } = params;
  const router = useRouter();
  const kinescopeRef = useRef<KinescopePlayerRef>(null);
  const { user } = useAuthGuard();
  const isOwnerOrPm = user?.role === "OWNER" || user?.role === "PM";

  const { data: project, isLoading: projectLoading } = useSWR(`/api/projects/${projectId}`, apiFetch<ProjectResponse>);
  const { data: versionsResponse, isLoading: versionsLoading, mutate: mutateVersions } = useSWR(
    `/api/projects/${projectId}/versions`,
    apiFetch<ApiWrapped<AssetVersionResponse[]>>,
  );
  const {
    data: feedbackResponse = [],
    isLoading: feedbackLoading,
    mutate: mutateFeedback,
  } = useSWR(`/api/projects/${projectId}/feedback`, apiFetch<FeedbackResponse[]>);

  const versions = useMemo(
    () => (versionsResponse ? [...unwrap(versionsResponse)].sort((a, b) => a.versionNumber - b.versionNumber) : []),
    [versionsResponse],
  );

  const [activeVersionId, setActiveVersionId] = useState<string>(versionId);
  const [activeFilter, setActiveFilter] = useState<FeedbackFilter>("all");
  const [openThreadIds, setOpenThreadIds] = useState<Set<string>>(() => new Set());
  const [resettingPortalLink, setResettingPortalLink] = useState(false);
  const [deletingVersion, setDeletingVersion] = useState(false);
  const [activeAnnotation, setActiveAnnotation] = useState<AnnotationData | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [deleteMenuPosition, setDeleteMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const autoViewedVersionsRef = useRef<Set<string>>(new Set());
  const longPressTimerRef = useRef<number | null>(null);
  const shareMenuRef = useRef<HTMLDivElement | null>(null);
  const shareButtonRef = useRef<HTMLButtonElement | null>(null);
  const deleteMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (versionId) {
      setActiveVersionId(versionId);
    }
  }, [versionId]);

  useEffect(() => {
    setActiveAnnotation(null);
  }, [activeVersionId]);

  useEffect(() => {
    setActiveFilter("all");
    setOpenThreadIds(new Set());
    setDeleteMenuPosition(null);
    setShareMenuOpen(false);
  }, [activeVersionId]);

  useEffect(() => {
    if (!activeVersionId && versions.length > 0) {
      setActiveVersionId(versions[versions.length - 1].id);
    }
  }, [activeVersionId, versions]);

  const activeVersion = useMemo(
    () => versions.find((version) => version.id === activeVersionId) ?? versions[versions.length - 1],
    [activeVersionId, versions],
  );

  const versionFeedback = useMemo(() => {
    if (!activeVersion) {
      return [];
    }

    return feedbackResponse
      .filter((item) => item.assetVersionId === activeVersion.id && item.authorType === "CLIENT")
      .sort((a, b) => {
        const aTime = a.timecodeSec ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.timecodeSec ?? Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) {
          return aTime - bTime;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [activeVersion, feedbackResponse]);

  const visibleBaseFeedback = useMemo(
    () => versionFeedback.filter((item) => item.status !== "REJECTED"),
    [versionFeedback],
  );

  const feedbackCounts = useMemo(() => {
    const counts: Record<Exclude<FeedbackFilter, "all">, number> = {
      NEW: 0,
      VIEWED: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
    };
    for (const item of visibleBaseFeedback) {
      const status = (item.status ?? "NEW") as Exclude<FeedbackFilter, "all">;
      if (status in counts) {
        counts[status] += 1;
      }
    }
    return counts;
  }, [visibleBaseFeedback]);

  const filteredFeedback = useMemo(() => {
    if (activeFilter === "all") {
      return visibleBaseFeedback;
    }
    return visibleBaseFeedback.filter((item) => (item.status ?? "NEW") === activeFilter);
  }, [activeFilter, visibleBaseFeedback]);

  const hasClientFeedback = visibleBaseFeedback.length > 0;
  const versionUiStatus = activeVersion ? toVersionUiStatus(activeVersion.status, hasClientFeedback) : "DRAFT";
  const playbackPolicy = getAnnotationPlaybackPolicy();
  const overlayStrokes = activeAnnotation?.strokes ?? [];
  const renderStroke = (stroke: AnnotationStroke, index: number): JSX.Element => (
    <g key={`stroke-${index}`} dangerouslySetInnerHTML={{ __html: strokeToSvg(stroke) }} />
  );

  const toggleThread = (threadId: string): void => {
    setOpenThreadIds((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  const seekToTimecode = (timecodeSec: number | null, annotation: FeedbackResponse["annotationData"]): void => {
    const target = Number.isFinite(timecodeSec) ? Math.max(0, timecodeSec as number) : 0;
    kinescopeRef.current?.seekTo(target);
    if (playbackPolicy.pauseOnCommentSelect) {
      kinescopeRef.current?.pause();
    }
    setActiveAnnotation(normalizeAnnotationData(annotation));
  };

  useEffect(() => {
    if (!activeVersion || !isOwnerOrPm || feedbackLoading) {
      return;
    }
    if (autoViewedVersionsRef.current.has(activeVersion.id)) {
      return;
    }

    const newItems = visibleBaseFeedback.filter((item) => (item.status ?? "NEW") === "NEW");
    autoViewedVersionsRef.current.add(activeVersion.id);
    if (newItems.length === 0) {
      return;
    }

    const ids = newItems.map((item) => item.id);

    mutateFeedback(
      (previous) => {
        const prevItems = previous ?? [];
        return prevItems.map((item) => (ids.includes(item.id) ? { ...item, status: "VIEWED" } : item));
      },
      { revalidate: false },
    );

    void (async () => {
      const results = await Promise.allSettled(
        ids.map((id) =>
          apiFetch(`/api/feedback/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "VIEWED" }),
          }),
        ),
      );

      const failedIds = ids.filter((_, index) => results[index]?.status === "rejected");
      if (failedIds.length > 0) {
        mutateFeedback(
          (previous) => {
            const prevItems = previous ?? [];
            return prevItems.map((item) => (failedIds.includes(item.id) ? { ...item, status: "NEW" } : item));
          },
          { revalidate: false },
        );
        toast.error("Не удалось отметить некоторые правки как просмотренные");
      }
    })();
  }, [activeVersion, feedbackLoading, isOwnerOrPm, mutateFeedback, visibleBaseFeedback]);

  const handleCopyPublicLink = async (): Promise<void> => {
    if (!project?.portalToken) {
      return;
    }

    try {
      await copyToClipboard(createPublicPortalLink(project.portalToken));
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не удалось скопировать ссылку");
    }
  };

  const handleOpenPublicLink = (): void => {
    if (!project?.portalToken) {
      return;
    }

    const url = createPublicPortalLink(project.portalToken);
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.assign(url);
    }
  };

  const handleResetPublicLink = async (): Promise<void> => {
    setResettingPortalLink(true);
    try {
      const result = await apiFetch<{ portalToken: string }>(`/api/projects/${projectId}/portal-token/reset`, {
        method: "POST",
      });
      await copyToClipboard(createPublicPortalLink(result.portalToken));
      toast.success("Новая публичная ссылка создана и скопирована");
    } catch {
      toast.error("Не удалось сбросить публичную ссылку");
    } finally {
      setResettingPortalLink(false);
    }
  };

  const handleDeleteVersion = async (): Promise<void> => {
    if (!activeVersion) {
      return;
    }

    const confirmed = window.confirm(`Удалить версию ${activeVersion.versionNumber}? Все правки будут удалены.`);
    if (!confirmed) {
      return;
    }

    setDeletingVersion(true);
    try {
      await apiFetch(`/api/projects/${projectId}/versions/${activeVersion.id}`, {
        method: "DELETE",
      });

      await mutateVersions(
        async (previous) => {
          const isWrapped = previous !== null && typeof previous === "object" && "data" in (previous as Record<string, unknown>);
          const current = previous ? unwrap(previous as ApiWrapped<AssetVersionResponse[]>) : [];
          const remaining = current.filter((item) => item.id !== activeVersion.id);

          if (remaining.length === 0) {
            router.replace(`/projects/${projectId}`);
          } else {
            const fallback = remaining[remaining.length - 1];
            setActiveVersionId(fallback.id);
          }

          if (!previous) {
            return remaining as ApiWrapped<AssetVersionResponse[]>;
          }

          return isWrapped ? ({ data: remaining } as ApiWrapped<AssetVersionResponse[]>) : (remaining as ApiWrapped<AssetVersionResponse[]>);
        },
        { revalidate: true },
      );

      toast.success("Версия удалена");
    } catch {
      toast.error("Не удалось удалить версию");
    } finally {
      setDeletingVersion(false);
    }
  };

  const openDeleteMenu = (x: number, y: number): void => {
    setShareMenuOpen(false);
    if (typeof window === "undefined") {
      setDeleteMenuPosition({ x, y });
      return;
    }

    setDeleteMenuPosition({
      x: Math.max(16, Math.min(x, window.innerWidth - 220)),
      y: Math.max(16, Math.min(y, window.innerHeight - 80)),
    });
  };

  const handleVersionContextMenu = (event: MouseEvent<HTMLButtonElement>, targetVersionId: string): void => {
    if (!isOwnerOrPm || targetVersionId !== activeVersion.id) {
      return;
    }

    event.preventDefault();
    openDeleteMenu(event.clientX, event.clientY);
  };

  const clearLongPressTimer = (): void => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleVersionPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, targetVersionId: string): void => {
    if (!isOwnerOrPm || targetVersionId !== activeVersion.id || event.pointerType === "mouse") {
      return;
    }

    clearLongPressTimer();
    const currentTarget = event.currentTarget;
    longPressTimerRef.current = window.setTimeout(() => {
      const rect = currentTarget.getBoundingClientRect();
      openDeleteMenu(rect.left + rect.width / 2, rect.bottom + 12);
      longPressTimerRef.current = null;
    }, 550);
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null;
      if (
        shareMenuRef.current?.contains(target) ||
        shareButtonRef.current?.contains(target) ||
        deleteMenuRef.current?.contains(target)
      ) {
        return;
      }

      setShareMenuOpen(false);
      setDeleteMenuPosition(null);
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setShareMenuOpen(false);
        setDeleteMenuPosition(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      clearLongPressTimer();
    };
  }, []);

  const canReply = isOwnerOrPm;

  if (projectLoading || versionsLoading || !project) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-white/10 bg-[#09090f] py-10 text-white">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-300" />
      </div>
    );
  }

  if (!activeVersion) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#09090f] py-8 text-center text-sm text-white/60">Версия не найдена.</div>
    );
  }

  return (
    <main className="pm-etalon h-[100dvh] overflow-hidden text-white">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1760px] flex-col gap-3 px-4 py-4 xl:px-6 xl:py-5">
        <section className="shrink-0 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] px-6 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <span className="text-[11px] uppercase tracking-[0.16em] text-[#8fa4d48f]">Project review workspace</span>
              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <h1 className="text-[clamp(24px,2.4vw,32px)] font-bold leading-none tracking-[-0.04em]">{project.name}</h1>
                <span className="h-5 w-px bg-white/10" />
                <span className="text-[13px] text-white/55">Версия {activeVersion.versionNumber}</span>
                <span className="text-[13px] text-white/55">{VERSION_STATUS_LABELS[versionUiStatus]}</span>
                {feedbackCounts.NEW > 0 ? (
                  <span className="rounded-full border border-red-400/25 bg-red-950/40 px-3 py-1 text-[11px] font-semibold text-red-200">
                    Есть правки
                  </span>
                ) : null}
              </div>
            </div>

            <div className="relative flex flex-wrap gap-2 xl:justify-end">
              <button ref={shareButtonRef} type="button" className="pm-btn pm-btn-muted" onClick={() => setShareMenuOpen((current) => !current)}>Поделиться</button>
              <VersionUploadDialog projectId={projectId} triggerText="+ Новая версия" triggerClassName="pm-btn pm-btn-primary" />

              {shareMenuOpen ? (
                <div ref={shareMenuRef} className="pm-share-menu">
                  <button type="button" className="pm-share-item" onClick={() => void handleCopyPublicLink()}>
                    Создать ссылку
                  </button>
                  <button type="button" className="pm-share-item" onClick={() => void handleResetPublicLink()} disabled={resettingPortalLink}>
                    {resettingPortalLink ? "Сброс..." : "Сбросить ссылку"}
                  </button>
                  <button type="button" className="pm-share-item" onClick={handleOpenPublicLink} disabled={!project.portalToken}>
                    Перейти по ссылке
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="shrink-0 rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="flex shrink-0 items-center gap-2 overflow-x-auto scrollbar-none">
        {versions.map((version) => {
          const isActive = version.id === activeVersion.id;
          return (
            <button
              key={version.id}
              type="button"
              className={cn(
                "rounded-full border px-4 py-2 text-xs font-semibold transition",
                isActive
                  ? "border-indigo-300/35 bg-[linear-gradient(135deg,rgba(67,87,255,0.2),rgba(56,189,248,0.12))] text-indigo-100"
                  : "border-white/10 bg-white/[0.03] text-white/40 hover:border-white/15 hover:text-white/75",
              )}
              onClick={() => setActiveVersionId(version.id)}
              onContextMenu={(event) => handleVersionContextMenu(event, version.id)}
              onPointerDown={(event) => handleVersionPointerDown(event, version.id)}
              onPointerUp={clearLongPressTimer}
              onPointerCancel={clearLongPressTimer}
              onPointerLeave={clearLongPressTimer}
            >
              Версия {version.versionNumber}
            </button>
          );
        })}
        <VersionUploadDialog
          projectId={projectId}
          triggerText="+ Создать новую"
          triggerVariant="outline"
          triggerSize="sm"
          triggerClassName="rounded-full border border-dashed border-white/15 bg-transparent px-4 py-2 text-xs font-semibold text-white/35 hover:border-white/20 hover:text-white/60"
        />
          </div>
        </section>

        <section className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.9fr)]">
          <div className="left-col flex min-w-0 min-h-0 flex-col gap-3 overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="relative aspect-video min-h-[320px] w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#05070d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_26px_60px_rgba(0,0,0,0.42)] xl:min-h-[380px] 2xl:min-h-[430px]">
                <KinescopePlayer
                  ref={kinescopeRef}
                  className="h-full w-full"
                  videoId={activeVersion.kinescopeVideoId}
                  videoUrl={activeVersion.streamUrl ?? activeVersion.fileUrl}
                  onPlay={() => {
                    if (playbackPolicy.hideOnPlay) {
                      setActiveAnnotation(null);
                    }
                  }}
                />
                {overlayStrokes.length > 0 ? (
                  <div className="pointer-events-none absolute inset-0">
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
                      {overlayStrokes.map((stroke, index) =>
                        renderStroke(
                          stroke.type === "arrow"
                            ? { ...stroke, points: stroke.points }
                            : stroke,
                          index,
                        ),
                      )}
                    </svg>
                    <button
                      type="button"
                      onClick={() => setActiveAnnotation(null)}
                      className="pointer-events-auto absolute right-4 top-4 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_10px_20px_rgba(0,0,0,0.25)] backdrop-blur"
                    >
                      Скрыть аннотацию
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.78)_0%,rgba(10,12,20,0.84)_100%)] px-4 py-3 text-[11px] text-white/55 shadow-[0_14px_34px_rgba(0,0,0,0.22)]">
                <div className="flex flex-wrap gap-3">
                  <span>{activeVersion.fileName}</span>
                  <span>Загрузил: {activeVersion.uploadedBy.name}</span>
                  <span>{formatDate(activeVersion.createdAt)}</span>
                </div>
                {activeVersion.processingStatus !== "READY" ? (
                  <p className="text-xs text-white/60">
                    {activeVersion.processingStatus === "FAILED"
                      ? "Обработка видео в Kinescope завершилась с ошибкой."
                      : "Kinescope ещё обрабатывает видео. Воспроизведение может быть временно недоступно."}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
              <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">Новые</div>
                <div className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.05em] text-amber-300">{feedbackCounts.NEW}</div>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">Просмотрено</div>
                <div className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.05em] text-white/80">{feedbackCounts.VIEWED}</div>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">В работе</div>
                <div className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.05em] text-sky-300">{feedbackCounts.IN_PROGRESS}</div>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">Готово</div>
                <div className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.05em] text-emerald-300">{feedbackCounts.RESOLVED}</div>
              </div>
            </div>

            <div className="shrink-0 rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <button
                type="button"
                onClick={() => toast.info("В разработке")}
                className="inline-flex items-center gap-2 rounded-[12px] border border-indigo-300/20 bg-[linear-gradient(135deg,rgba(52,65,202,0.22),rgba(56,189,248,0.12))] px-4 py-2.5 text-sm font-semibold text-indigo-100"
              >
                <Download className="h-3.5 w-3.5" />
                Выгрузить XML для монтажёра
              </button>
              <p className="mt-2 text-[11px] text-white/40">Все «Новые» и «Просмотренные» можно быстро перевести в производственный контур.</p>
            </div>
          </div>

          <aside className="min-h-0 overflow-hidden">
            <div className="flex h-full min-h-0 flex-col rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="flex shrink-0 items-start justify-between gap-3 pb-3">
                <div>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-[#8fa4d48f]">Review inbox</span>
                  <h2 className="mt-1.5 text-[20px] font-semibold tracking-[-0.03em]">
                    Правки <span className="font-medium text-white/35">({visibleBaseFeedback.length})</span>
                  </h2>
                </div>
                {feedbackLoading ? <Loader2 className="h-4 w-4 animate-spin text-sky-300" /> : null}
              </div>

              <div className="flex shrink-0 gap-2 overflow-x-auto pb-3 scrollbar-none">
                {(Object.keys(FILTER_LABELS) as FeedbackFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={cn(
                      "rounded-full border px-3 py-2 text-[11px] font-semibold whitespace-nowrap transition",
                      activeFilter === filter
                        ? "border-indigo-300/30 bg-[linear-gradient(135deg,rgba(67,87,255,0.22),rgba(56,189,248,0.12))] text-white"
                        : "border-white/10 bg-white/[0.03] text-white/45 hover:border-white/15 hover:text-white/75",
                    )}
                  >
                    {FILTER_LABELS[filter]}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {feedbackLoading ? <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/45">Загрузка правок...</div> : null}

                {!feedbackLoading && filteredFeedback.length === 0 ? (
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/45">
                    Правок пока нет
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredFeedback.map((item) => {
                      const isOpen = openThreadIds.has(item.id);
                      const status = (item.status ?? "NEW") as FeedbackStatus;
                      return (
                        <article
                          key={item.id}
                          onClick={() => toggleThread(item.id)}
                          className={cn(
                            "overflow-hidden rounded-[24px] border bg-[linear-gradient(180deg,rgba(20,22,33,0.94),rgba(14,16,25,0.96))] transition cursor-pointer",
                            isOpen ? "border-indigo-300/25 shadow-[0_18px_36px_rgba(0,0,0,0.24)]" : "border-white/10 hover:border-white/20",
                          )}
                        >
                          <div className="relative flex gap-3 p-3.5">
                            {!isOpen && status === "NEW" ? <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_14px_rgba(124,140,255,0.72)]" /> : null}
                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-white/95">{item.author.name}</span>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    seekToTimecode(item.timecodeSec, item.annotationData);
                                  }}
                                  className={cn(
                                    "rounded-full border px-2.5 py-1 text-[11px] font-bold",
                                    item.timecodeSec !== null
                                      ? "border-sky-300/15 bg-sky-400/10 text-sky-100"
                                      : "border-white/10 bg-white/[0.04] text-white/35",
                                  )}
                                >
                                  {item.timecodeSec !== null ? formatTimecode(item.timecodeSec) : "Без таймкода"}
                                </button>
                              </div>

                              <p className="text-sm leading-6 text-white/72">{item.text}</p>

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                {item.annotationData ? (
                                  <span className="inline-flex items-center gap-2 text-[11px] text-sky-200/75">
                                    <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
                                    С аннотацией
                                  </span>
                                ) : null}
                                <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold", STATUS_BADGE_CLASSES[status])}>
                                  {STATUS_BADGE_LABELS[status]}
                                </span>
                                <span className="text-[11px] text-white/30">0 ответов</span>
                              </div>
                            </div>

                            <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-white/30 transition", isOpen && "rotate-180 text-white/80")} />
                          </div>

                          <div
                            onClick={(event) => event.stopPropagation()}
                            className={cn(
                              "grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out",
                              isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                            )}
                          >
                            <div className="min-h-0">
                              <div className="mx-4 border-t border-white/10 pt-3">
                                <span className="text-[10px] uppercase tracking-[0.16em] text-white/30">Thread</span>
                                <p className="mt-2 text-xs leading-6 text-white/55">
                                  Ответы появятся здесь. Зона уже собрана как более плотный PM-review thread.
                                </p>
                              </div>
                              <div className="flex items-center gap-2 p-3.5">
                                <input
                                  disabled={!canReply}
                                  placeholder="Ответить клиенту..."
                                  className={cn(
                                    "min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white outline-none placeholder:text-white/30",
                                    !canReply && "text-white/30 placeholder:text-white/15",
                                  )}
                                />
                                <button
                                  type="button"
                                  disabled={!canReply}
                                  className={cn(
                                    "flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(99,102,241,0.96),rgba(56,189,248,0.72))] text-white shadow-[0_10px_24px_rgba(67,87,255,0.22)]",
                                    !canReply && "bg-white/10 text-white/30 shadow-none",
                                  )}
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>

      {deleteMenuPosition ? (
        <div
          ref={deleteMenuRef}
          className="pm-delete-menu"
          style={{ left: deleteMenuPosition.x, top: deleteMenuPosition.y }}
        >
          <button
            type="button"
            className="pm-delete-item"
            onClick={() => {
              setDeleteMenuPosition(null);
              void handleDeleteVersion();
            }}
            disabled={deletingVersion}
          >
            {deletingVersion ? "Удаление..." : "Удалить версию"}
          </button>
        </div>
      ) : null}

      <style jsx global>{`
        .pm-etalon {
          background:
            radial-gradient(circle at top left, rgba(67, 87, 255, 0.18), transparent 26%),
            radial-gradient(circle at 80% 20%, rgba(22, 163, 74, 0.08), transparent 24%),
            linear-gradient(180deg, #070811 0%, #0b0d14 48%, #090b12 100%);
        }
        .pm-btn {
          height: 42px;
          border-radius: 14px;
          padding: 0 16px;
          font-size: 13px;
          font-weight: 600;
          transition: 180ms ease;
        }
        .pm-btn:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
        .pm-btn-muted {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: rgba(230, 236, 247, 0.72);
        }
        .pm-btn-muted:hover:not(:disabled) {
          border-color: rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.08);
          color: rgba(248, 250, 255, 0.96);
        }
        .pm-btn-primary {
          border: 1px solid rgba(129, 140, 248, 0.4);
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.92), rgba(56, 189, 248, 0.78));
          color: white;
          box-shadow: 0 12px 28px rgba(63, 90, 255, 0.28);
        }
        .pm-btn-danger {
          border: 1px solid rgba(248, 113, 113, 0.24);
          background: rgba(127, 29, 29, 0.18);
          color: rgba(254, 202, 202, 0.88);
        }
        .pm-share-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 10px);
          z-index: 30;
          display: flex;
          min-width: 220px;
          flex-direction: column;
          gap: 6px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: linear-gradient(180deg, rgba(18, 20, 31, 0.98), rgba(10, 12, 20, 0.98));
          padding: 8px;
          box-shadow: 0 18px 44px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(20px);
        }
        .pm-share-item {
          border-radius: 12px;
          padding: 11px 12px;
          text-align: left;
          font-size: 13px;
          font-weight: 600;
          color: rgba(240, 244, 255, 0.88);
          transition: 160ms ease;
        }
        .pm-share-item:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.06);
        }
        .pm-share-item:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }
        .pm-delete-menu {
          position: fixed;
          z-index: 40;
          min-width: 180px;
          border-radius: 16px;
          border: 1px solid rgba(248, 113, 113, 0.16);
          background: linear-gradient(180deg, rgba(18, 20, 31, 0.98), rgba(10, 12, 20, 0.98));
          padding: 8px;
          box-shadow: 0 18px 44px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(20px);
          transform: translate(-50%, 0);
        }
        .pm-delete-item {
          width: 100%;
          border-radius: 12px;
          padding: 11px 12px;
          text-align: left;
          font-size: 13px;
          font-weight: 600;
          color: rgba(254, 202, 202, 0.92);
          transition: 160ms ease;
        }
        .pm-delete-item:hover:not(:disabled) {
          background: rgba(127, 29, 29, 0.24);
        }
        .pm-delete-item:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }
        .left-col::-webkit-scrollbar {
          width: 4px;
        }
        .left-col::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
          border-radius: 999px;
        }
        @media (max-width: 1100px) {
          .pm-btn {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}





