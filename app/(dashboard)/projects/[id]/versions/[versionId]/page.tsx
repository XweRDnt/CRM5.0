"use client";

import useSWR from "swr";
import { useEffect, useMemo, useRef, useState } from "react";
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
  FEEDBACK_STATUS_ACTIVE_CLASSES,
  FEEDBACK_STATUS_LABELS,
  VERSION_STATUS_BADGE_CLASSES,
  VERSION_STATUS_LABELS,
  toVersionUiStatus,
} from "@/lib/constants/status-ui";
import type { AssetVersionResponse, FeedbackResponse, ProjectResponse } from "@/types";

type ApiWrapped<T> = T | { data: T };

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
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activeVersion) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-neutral-400">Версия не найдена.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-neutral-100">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-medium text-neutral-100">Версия {activeVersion.versionNumber}</span>
              <span
                className={cn(
                  "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
                  VERSION_STATUS_BADGE_CLASSES[versionUiStatus],
                )}
              >
                {VERSION_STATUS_LABELS[versionUiStatus]}
              </span>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" onClick={handleCopyPublicLink}>
              Публичная ссылка
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="inline-flex min-w-full gap-2 md:min-w-0">
            {versions.map((version) => {
              const isActive = version.id === activeVersion.id;

              return (
                <button
                  key={version.id}
                  type="button"
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "border-blue-500 bg-blue-500/20 text-blue-200"
                      : "border-neutral-700 bg-neutral-900/60 text-neutral-300 hover:bg-neutral-800",
                  )}
                  onClick={() => setActiveVersionId(version.id)}
                >
                  Версия {version.versionNumber}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="space-y-3 xl:col-span-3">
          <Card className="border-neutral-700 bg-neutral-900/50">
            <CardContent className="p-3 sm:p-4">
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

          <p className="text-xs text-neutral-400">
            {activeVersion.fileName} • Загрузил: {activeVersion.uploadedBy.name} • {formatDate(activeVersion.createdAt)}
          </p>
        </div>

        <aside className="xl:col-span-2">
          <Card className="border-neutral-700 bg-neutral-900/50">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-100">Правки ({versionFeedback.length})</h2>
                {feedbackLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
              </div>

              {isActiveVersionApproved && (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">
                  Версия утверждена клиентом
                </div>
              )}

              {versionFeedback.length === 0 ? (
                <p className="text-sm text-neutral-400">Клиент ещё не оставил правок</p>
              ) : (
                <div className="space-y-2">
                  {versionFeedback.map((item) => {
                    const isNew = item.status === "NEW";

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "rounded-md border border-neutral-700 bg-neutral-900/70 p-3",
                          isNew && "border-l-2 border-l-red-500",
                        )}
                      >
                        <div className="mb-2 flex items-center gap-2 text-sm">
                          <button
                            type="button"
                            className="font-medium text-blue-300 hover:text-blue-200"
                            onClick={() => seekToTimecode(item.timecodeSec)}
                          >
                            [{formatTimecode(item.timecodeSec)}]
                          </button>
                          <span className="text-neutral-300">{item.author.name}</span>
                        </div>

                        <p className="mb-3 text-sm text-neutral-100">"{item.text}"</p>

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
                                  "rounded-md border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                                  isActive
                                    ? FEEDBACK_STATUS_ACTIVE_CLASSES[status]
                                    : "border-neutral-600 bg-neutral-800 text-neutral-300 hover:bg-neutral-700",
                                )}
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
