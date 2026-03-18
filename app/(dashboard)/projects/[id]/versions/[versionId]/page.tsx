"use client";

import useSWR from "swr";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronDown, Download, Loader2, Send } from "lucide-react";
import type { FeedbackStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
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
type VersionUiStatus = ReturnType<typeof toVersionUiStatus>;
type FeedbackFilter = "all" | "NEW" | "VIEWED" | "IN_PROGRESS" | "RESOLVED";

const VERSION_BADGE_CLASSES: Record<VersionUiStatus, string> = {
  DRAFT: "border-white/20 bg-white/10 text-white/70",
  IN_REVIEW: "border-amber-400/30 bg-amber-400/15 text-amber-200",
  CHANGES_REQUESTED: "border-rose-400/30 bg-rose-400/15 text-rose-200",
  APPROVED: "border-emerald-400/30 bg-emerald-400/15 text-emerald-200",
};

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
  const autoViewedVersionsRef = useRef<Set<string>>(new Set());

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
  const isActiveVersionApproved = versionUiStatus === "APPROVED";
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

  const glassPanelClass = "rounded-[18px] border border-white/10 bg-white/[0.048] backdrop-blur-2xl";
  const glassCardClass = "rounded-[13px] border border-white/10 bg-white/[0.04]";
  const pillBase = "rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap";
  const filterActive = "border-indigo-400/40 bg-indigo-500/20 text-indigo-200";
  const filterInactive = "border-white/10 bg-white/5 text-white/45 hover:border-white/20 hover:text-white/70";
  const canReply = isOwnerOrPm;

  if (projectLoading || versionsLoading || !project) {
    return (
      <div className={cn("flex items-center justify-center py-10 text-white", glassPanelClass)}>
        <Loader2 className="h-6 w-6 animate-spin text-indigo-300" />
      </div>
    );
  }

  if (!activeVersion) {
    return (
      <div className={cn("py-8 text-center text-sm text-white/60", glassPanelClass)}>Версия не найдена.</div>
    );
  }

  return (
    <main className="flex h-[100dvh] min-h-0 flex-col overflow-hidden text-white">
      <div className="flex w-full shrink-0 flex-col gap-4 px-6 pt-6">
        <div className={cn("flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6", glassPanelClass)}>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-white sm:text-2xl">{project.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/60">
              <span>Версия {activeVersion.versionNumber}</span>
              <span className="text-white/40">·</span>
              <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", VERSION_BADGE_CLASSES[versionUiStatus])}>
                {VERSION_STATUS_LABELS[versionUiStatus]}
              </span>
            </div>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
            <Button
              variant="outline"
              onClick={handleCopyPublicLink}
              className="rounded-full border-white/10 bg-white/[0.05] px-4 py-2 text-white/70 hover:bg-white/[0.1]"
            >
              Публичная ссылка
            </Button>
            <Button
              variant="outline"
              onClick={handleOpenPublicLink}
              disabled={!project?.portalToken}
              className="rounded-full border-white/10 bg-white/[0.05] px-4 py-2 text-white/70 hover:bg-white/[0.1]"
            >
              Открыть портал
            </Button>
            <Button
              variant="outline"
              onClick={handleResetPublicLink}
              disabled={resettingPortalLink}
              className="rounded-full border-white/10 bg-white/[0.05] px-4 py-2 text-white/70 hover:bg-white/[0.1]"
            >
              {resettingPortalLink ? "Сброс..." : "Сбросить ссылку"}
            </Button>
            {isOwnerOrPm && (
              <Button
                variant="destructive"
                onClick={() => void handleDeleteVersion()}
                disabled={deletingVersion}
                className="rounded-full bg-red-500/15 px-4 py-2 text-red-200 hover:bg-red-500/25"
              >
                {deletingVersion ? "Удаление..." : "Удалить версию"}
              </Button>
            )}
          </div>
        </div>

        <div className={cn("px-4 py-3 sm:px-5", glassPanelClass)}>
          <div className="flex flex-wrap gap-3">
            {versions.map((version) => {
              const isActive = version.id === activeVersion.id;
              return (
                <button
                  key={version.id}
                  type="button"
                  className={cn(
                    "rounded-full border px-4 py-2 text-xs font-semibold transition",
                    isActive
                      ? "border-indigo-400/40 bg-indigo-500/20 text-indigo-200"
                      : "border-white/10 bg-white/[0.03] text-white/45 hover:border-white/20 hover:text-white/70",
                  )}
                  onClick={() => setActiveVersionId(version.id)}
                >
                  Версия {version.versionNumber}
                </button>
              );
            })}

            <VersionUploadDialog
              projectId={projectId}
              triggerText="+ Создать новую версию"
              triggerVariant="outline"
              triggerSize="sm"
              triggerClassName="w-full basis-full rounded-full border-white/15 bg-white/[0.03] px-4 py-2 text-white/55 hover:border-white/25 hover:text-white sm:w-auto sm:basis-auto sm:whitespace-nowrap"
            />
          </div>
        </div>
      </div>

      <section className="flex flex-1 gap-6 overflow-hidden px-6 pb-6">
          <div className="min-w-0 flex-1 space-y-4 overflow-y-auto pr-2">
            <div className={cn("p-3 sm:p-4", glassPanelClass)}>
              <div className="relative max-h-[45vh] overflow-hidden rounded-[14px] border border-white/10 bg-[#07070f]">
                <KinescopePlayer
                  ref={kinescopeRef}
                  className="h-[45vh] max-h-[45vh] w-full"
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
                      className="pointer-events-auto absolute right-3 top-3 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-xs text-white"
                    >
                      Скрыть
                    </button>
                  </div>
                ) : null}
              </div>
              {activeVersion.processingStatus !== "READY" ? (
                <p className="mt-2 text-xs text-white/55">
                  {activeVersion.processingStatus === "FAILED"
                    ? "Обработка видео в Kinescope завершилась с ошибкой."
                    : "Kinescope ещё обрабатывает видео. Воспроизведение может быть временно недоступно."}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className={cn("min-w-[110px] px-3 py-3 text-center", glassCardClass)}>
                <div className="text-lg font-semibold text-amber-300">{feedbackCounts.NEW}</div>
                <div className="whitespace-nowrap text-[10px] uppercase tracking-[0.12em] text-white/35">Новые</div>
              </div>
              <div className={cn("min-w-[110px] px-3 py-3 text-center", glassCardClass)}>
                <div className="text-lg font-semibold text-white/70">{feedbackCounts.VIEWED}</div>
                <div className="whitespace-nowrap text-[10px] uppercase tracking-[0.12em] text-white/35">Просмотрено</div>
              </div>
              <div className={cn("min-w-[110px] px-3 py-3 text-center", glassCardClass)}>
                <div className="text-lg font-semibold text-blue-300">{feedbackCounts.IN_PROGRESS}</div>
                <div className="whitespace-nowrap text-[10px] uppercase tracking-[0.12em] text-white/35">В работе</div>
              </div>
              <div className={cn("min-w-[110px] px-3 py-3 text-center", glassCardClass)}>
                <div className="text-lg font-semibold text-emerald-300">{feedbackCounts.RESOLVED}</div>
                <div className="whitespace-nowrap text-[10px] uppercase tracking-[0.12em] text-white/35">Готово</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => toast.info("В разработке")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/20"
            >
              <Download className="h-4 w-4" />
              Выгрузить XML
            </button>

            <p className="break-words text-xs leading-relaxed text-white/45">
              {activeVersion.fileName} • Загружил: {activeVersion.uploadedBy.name} • {formatDate(activeVersion.createdAt)}
            </p>
          </div>

          <aside className="flex min-w-0 flex-[0_0_minmax(380px,440px)] flex-col gap-4 overflow-hidden">
            <div className="flex shrink-0 flex-col gap-4">
              <div className={cn("sticky top-0 z-10 p-3 sm:p-4", glassPanelClass)}>
                <div className="flex flex-nowrap gap-2 overflow-hidden">
                  {(Object.keys(FILTER_LABELS) as FeedbackFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActiveFilter(filter)}
                      className={cn(pillBase, activeFilter === filter ? filterActive : filterInactive)}
                    >
                      {FILTER_LABELS[filter]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className={cn("flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5", glassPanelClass)}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                  Правки ({visibleBaseFeedback.length})
                </h2>
                {feedbackLoading && <Loader2 className="h-4 w-4 animate-spin text-indigo-300" />}
              </div>

              {isActiveVersionApproved && (
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-3 py-2 text-xs text-emerald-200">
                  Версия утверждена клиентом
                </div>
              )}

              {filteredFeedback.length === 0 ? (
                <div className={cn("px-4 py-6 text-center text-sm text-white/45", glassCardClass)}>
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
                          "cursor-pointer p-4 transition",
                          glassCardClass,
                          isOpen ? "border-indigo-400/30 bg-white/[0.06]" : "hover:border-white/20",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-white/70">{item.author.name}</span>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  seekToTimecode(item.timecodeSec, item.annotationData);
                                }}
                                className={cn(
                                  "rounded-md px-2 py-0.5 text-[11px] font-semibold",
                                  item.timecodeSec !== null
                                    ? "bg-indigo-500/15 text-indigo-200"
                                    : "bg-white/5 text-white/30",
                                )}
                              >
                                {item.timecodeSec !== null ? formatTimecode(item.timecodeSec) : "Без таймкода"}
                              </button>
                            </div>
                            <p className="text-sm leading-relaxed text-white/70">{item.text}</p>
                            {item.annotationData ? (
                              <div className="mt-2 flex items-center gap-2 text-[11px] text-indigo-200/70">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
                                с аннотацией
                              </div>
                            ) : null}
                            <div className="mt-2 flex items-center gap-2 text-[10px] text-white/35">
                              <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold", STATUS_BADGE_CLASSES[status])}>
                                {STATUS_BADGE_LABELS[status]}
                              </span>
                              <span className="text-white/30">0 ответов</span>
                            </div>
                          </div>
                          <div className={cn("mt-1 h-4 w-4 text-white/35 transition", isOpen && "rotate-180 text-indigo-200")}>
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </div>
                        <div
                          onClick={(event) => event.stopPropagation()}
                          className={cn(
                            "mt-3 overflow-hidden border-t border-white/10 pt-0 transition-all duration-300 ease-[cubic-bezier(.4,0,.2,1)]",
                            isOpen ? "max-h-48 pt-3 opacity-100" : "max-h-0 pt-0 opacity-0",
                          )}
                        >
                          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/45">
                            Ответы появятся здесь
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              disabled={!canReply}
                              placeholder="Ответить клиенту..."
                              className={cn(
                                "flex-1 rounded-xl border px-3 py-2 text-xs outline-none transition",
                                canReply
                                  ? "border-white/10 bg-white/[0.05] text-white/70 placeholder:text-white/30"
                                  : "border-white/5 bg-white/[0.03] text-white/30 placeholder:text-white/20",
                              )}
                            />
                            <button
                              type="button"
                              disabled={!canReply}
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-xl transition",
                                canReply ? "bg-indigo-500/25 text-indigo-100" : "bg-white/[0.05] text-white/30",
                              )}
                            >
                              <Send className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </section>
    </main>
  );
}





