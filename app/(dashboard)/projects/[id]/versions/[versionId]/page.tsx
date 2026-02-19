"use client";

import useSWR from "swr";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { FeedbackStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { YouTubePlayer, type YouTubePlayerRef } from "@/components/video/YouTubePlayer";
import { apiFetch } from "@/lib/utils/client-api";
import { cn } from "@/lib/utils/cn";
import {
  EDITOR_FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
  VERSION_STATUS_LABELS,
  toVersionUiStatus,
} from "@/lib/constants/status-ui";
import type { AssetVersionResponse, FeedbackResponse, ProjectResponse } from "@/types";

type ApiWrapped<T> = T | { data: T };
type VersionUiStatus = ReturnType<typeof toVersionUiStatus>;
type AppTheme = "light" | "dark";

const VERSION_BADGE_STYLES: Record<AppTheme, Record<VersionUiStatus, CSSProperties>> = {
  light: {
    DRAFT: { borderColor: "#6b7280", backgroundColor: "#e5e7eb", color: "#111827" },
    IN_REVIEW: { borderColor: "#b45309", backgroundColor: "#fde68a", color: "#78350f" },
    CHANGES_REQUESTED: { borderColor: "#b91c1c", backgroundColor: "#fecaca", color: "#7f1d1d" },
    APPROVED: { borderColor: "#047857", backgroundColor: "#bbf7d0", color: "#064e3b" },
  },
  dark: {
    DRAFT: { borderColor: "#6b7280", backgroundColor: "rgba(55, 65, 81, 0.7)", color: "#f3f4f6" },
    IN_REVIEW: { borderColor: "#d97706", backgroundColor: "rgba(217, 119, 6, 0.25)", color: "#fde68a" },
    CHANGES_REQUESTED: { borderColor: "#dc2626", backgroundColor: "rgba(220, 38, 38, 0.25)", color: "#fecaca" },
    APPROVED: { borderColor: "#059669", backgroundColor: "rgba(5, 150, 105, 0.25)", color: "#bbf7d0" },
  },
};

const ACTIVE_VERSION_BUTTON_STYLES: Record<AppTheme, CSSProperties> = {
  light: { borderColor: "#2563eb", backgroundColor: "#dbeafe", color: "#1e3a8a" },
  dark: { borderColor: "#3b82f6", backgroundColor: "rgba(59, 130, 246, 0.25)", color: "#bfdbfe" },
};

const APPROVED_BANNER_STYLES: Record<AppTheme, CSSProperties> = {
  light: { borderColor: "#34d399", backgroundColor: "#d1fae5", color: "#065f46" },
  dark: { borderColor: "rgba(16, 185, 129, 0.45)", backgroundColor: "rgba(16, 185, 129, 0.2)", color: "#a7f3d0" },
};

const FEEDBACK_ACTIVE_STYLES: Record<AppTheme, Record<"NEW" | "IN_PROGRESS" | "RESOLVED", CSSProperties>> = {
  light: {
    NEW: { borderColor: "#dc2626", backgroundColor: "#fecaca", color: "#7f1d1d" },
    IN_PROGRESS: { borderColor: "#d97706", backgroundColor: "#fde68a", color: "#78350f" },
    RESOLVED: { borderColor: "#059669", backgroundColor: "#bbf7d0", color: "#064e3b" },
  },
  dark: {
    NEW: { borderColor: "#dc2626", backgroundColor: "rgba(220, 38, 38, 0.25)", color: "#fecaca" },
    IN_PROGRESS: { borderColor: "#d97706", backgroundColor: "rgba(217, 119, 6, 0.25)", color: "#fde68a" },
    RESOLVED: { borderColor: "#059669", backgroundColor: "rgba(5, 150, 105, 0.25)", color: "#bbf7d0" },
  },
};
function unwrap<T>(payload: ApiWrapped<T>): T {
  return "data" in (payload as { data?: T }) ? (payload as { data: T }).data : (payload as T);
}

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/i.test(url);
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

function createPublicPortalLink(versionId: string): string {
  if (typeof window === "undefined") {
    return `/client-portal/${versionId}`;
  }

  return `${window.location.origin}/client-portal/${versionId}`;
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
  const htmlVideoRef = useRef<HTMLVideoElement>(null);
  const youtubeRef = useRef<YouTubePlayerRef>(null);

  const { data: project, isLoading: projectLoading } = useSWR(`/api/projects/${projectId}`, apiFetch<ProjectResponse>);
  const { data: versionsResponse, isLoading: versionsLoading } = useSWR(
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
  const [pendingFeedbackId, setPendingFeedbackId] = useState<string | null>(null);
  const [appTheme, setAppTheme] = useState<AppTheme>("light");

    useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    const readTheme = (): void => {
      setAppTheme(root.getAttribute("data-app-theme") === "dark" ? "dark" : "light");
    };

    readTheme();
    const observer = new MutationObserver(readTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-app-theme"] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (versionId) {
      setActiveVersionId(versionId);
    }
  }, [versionId]);

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

  const hasClientFeedback = versionFeedback.length > 0;
  const versionUiStatus = activeVersion ? toVersionUiStatus(activeVersion.status, hasClientFeedback) : "DRAFT";
  const isActiveVersionApproved = versionUiStatus === "APPROVED";

  const seekToTimecode = (timecodeSec: number | null): void => {
    const target = Number.isFinite(timecodeSec) ? Math.max(0, timecodeSec as number) : 0;

    if (activeVersion && isYouTubeUrl(activeVersion.fileUrl)) {
      youtubeRef.current?.seekTo(target);
      youtubeRef.current?.play();
      return;
    }

    if (htmlVideoRef.current) {
      htmlVideoRef.current.currentTime = target;
      void htmlVideoRef.current.play().catch(() => undefined);
    }
  };

  const handleChangeFeedbackStatus = async (feedbackId: string, status: FeedbackStatus): Promise<void> => {
    const current = feedbackResponse.find((item) => item.id === feedbackId);
    if (!current || current.status === status) {
      return;
    }

    setPendingFeedbackId(feedbackId);

    await mutateFeedback(
      async (previous) => {
        const prevItems = previous ?? [];
        const optimistic = prevItems.map((item) => (item.id === feedbackId ? { ...item, status } : item));

        try {
          await apiFetch(`/api/feedback/${feedbackId}`, {
            method: "PATCH",
            body: JSON.stringify({ status }),
          });
          return optimistic;
        } catch {
          toast.error("Не удалось обновить статус правки");
          return prevItems;
        } finally {
          setPendingFeedbackId(null);
        }
      },
      { revalidate: false },
    );
  };

  const handleCopyPublicLink = async (): Promise<void> => {
    if (!activeVersion) {
      return;
    }

    try {
      await copyToClipboard(createPublicPortalLink(activeVersion.id));
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не удалось скопировать ссылку");
    }
  };

  if (projectLoading || versionsLoading || !project) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500 dark:text-blue-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activeVersion) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-neutral-700 dark:text-neutral-400">Версия не найдена.</CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-full space-y-4 overflow-x-hidden px-1 sm:px-0">
      <header className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="break-words text-xl font-semibold text-neutral-900 dark:text-neutral-100 sm:text-2xl">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-medium text-neutral-900 dark:text-neutral-100 sm:text-lg">Версия {activeVersion.versionNumber}</span>
              <span
                className="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium"
                style={VERSION_BADGE_STYLES[appTheme][versionUiStatus]}
              >
                {VERSION_STATUS_LABELS[versionUiStatus]}
              </span>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" onClick={handleCopyPublicLink} className="w-full sm:w-auto">
              Публичная ссылка
            </Button>
          </div>
        </div>

        <div className="pb-1">
          <div className="flex flex-wrap gap-2">
            {versions.map((version) => {
              const isActive = version.id === activeVersion.id;

              return (
                <button
                  key={version.id}
                  type="button"
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "font-medium"
                      : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-300 dark:hover:bg-neutral-800",
                  )}
                  style={isActive ? ACTIVE_VERSION_BUTTON_STYLES[appTheme] : undefined}
                  onClick={() => setActiveVersionId(version.id)}
                >
                  Версия {version.versionNumber}
                </button>
              );
            })}

            <Button asChild variant="outline" size="sm" className="w-full basis-full sm:w-auto sm:basis-auto sm:whitespace-nowrap">
              <Link href={`/projects/${projectId}/versions/new`}>+ Создать новую версию</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="min-w-0 space-y-3 xl:col-span-3">
          <Card className="border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900/50">
            <CardContent className="p-2 sm:p-4">
              {isYouTubeUrl(activeVersion.fileUrl) ? (
                <YouTubePlayer ref={youtubeRef} videoUrl={activeVersion.fileUrl} className="w-full" />
              ) : (
                <video
                  ref={htmlVideoRef}
                  className="h-auto w-full rounded-lg bg-black"
                  controls
                  preload="metadata"
                  src={activeVersion.fileUrl}
                >
                  <track kind="captions" />
                </video>
              )}
            </CardContent>
          </Card>

          <p className="break-words text-xs leading-relaxed text-neutral-700 dark:text-neutral-400">
            {activeVersion.fileName} • Загрузил: {activeVersion.uploadedBy.name} • {formatDate(activeVersion.createdAt)}
          </p>
        </div>

        <aside className="min-w-0 xl:col-span-2">
          <Card className="border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900/50">
            <CardContent className="space-y-3 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 sm:text-lg">Правки ({versionFeedback.length})</h2>
                {feedbackLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-500 dark:text-blue-400" />}
              </div>

              {isActiveVersionApproved && (
                <div className="rounded-md border px-3 py-2 text-sm" style={APPROVED_BANNER_STYLES[appTheme]}>
                  Версия утверждена клиентом
                </div>
              )}

              {versionFeedback.length === 0 ? (
                <p className="text-sm text-neutral-700 dark:text-neutral-400">Клиент ещё не оставил правок</p>
              ) : (
                <div className="min-w-0 space-y-2">
                  {versionFeedback.map((item) => {
                    const isNew = item.status === "NEW";

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900/70",
                          isNew && "border-l-2 border-l-red-500",
                        )}
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                          <button
                            type="button"
                            className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                            onClick={() => seekToTimecode(item.timecodeSec)}
                          >
                            [{formatTimecode(item.timecodeSec)}]
                          </button>
                          <span className="break-words text-neutral-700 dark:text-neutral-300">{item.author.name}</span>
                        </div>

                        <p className="mb-3 break-words text-sm text-neutral-900 dark:text-neutral-100">"{item.text}"</p>

                        <div className="flex flex-wrap gap-2">
                          {EDITOR_FEEDBACK_STATUSES.map((status) => {
                            const isActive = item.status === status;
                            const disabled = pendingFeedbackId === item.id;

                            return (
                              <button
                                key={status}
                                type="button"
                                disabled={disabled}
                                onClick={() => handleChangeFeedbackStatus(item.id, status)}
                                className={cn(
                                  "max-w-full rounded-md border px-2.5 py-1 text-left text-xs whitespace-normal break-words transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                                  isActive
                                    ? "border"
                                    : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-300 dark:hover:bg-neutral-800",
                                )}
                                style={isActive ? FEEDBACK_ACTIVE_STYLES[appTheme][status] : undefined}
                              >
                                {FEEDBACK_STATUS_LABELS[status]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  );
}




