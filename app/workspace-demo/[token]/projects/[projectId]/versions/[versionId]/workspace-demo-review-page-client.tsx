"use client";

import Link from "next/link";
import useSWR from "swr";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Lock, MessageSquareQuote, PlayCircle } from "lucide-react";
import type { FeedbackThreadMessageResponse } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { KinescopePlayer, type KinescopePlayerRef } from "@/components/video/KinescopePlayer";
import { apiFetch } from "@/lib/utils/client-api";
import { FEEDBACK_STATUS_LABELS, VERSION_STATUS_BADGE_CLASSES, VERSION_STATUS_LABELS, toVersionUiStatus } from "@/lib/constants/status-ui";
import { cn } from "@/lib/utils/cn";

type WorkspaceDemoProjectDetailResponse = {
  workspace: {
    id: string;
    name: string;
  };
  readonly: true;
  project: {
    id: string;
    name: string;
    status: string;
    portalToken: string;
    client: {
      id: string;
      name: string;
      email: string;
    };
  };
  activeVersionId: string | null;
  versions: Array<{
    id: string;
    projectId: string;
    versionNumber: number;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    durationSec: number | null;
    videoProvider: "KINESCOPE";
    kinescopeVideoId: string | null;
    kinescopeAssetId: string | null;
    kinescopeProjectId: string | null;
    streamUrl: string | null;
    processingStatus: string;
    processingError: string | null;
    uploadedBy: {
      id: string;
      name: string;
    };
    notes: string | null;
    changeLog: string | null;
    status: "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "FINAL";
    approvedBy: string | null;
    approvedAt: string | null;
    createdAt: string;
  }>;
  feedback: Array<{
    id: string;
    assetVersionId: string;
    authorType: string;
    author: {
      id?: string;
      name: string;
      email?: string;
    };
    timecodeSec: number | null;
    text: string;
    category: string | null;
    status: "NEW" | "VIEWED" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
    annotationData?: unknown;
    threadMessageCount?: number;
    threadUnreadCount?: number;
    lastThreadMessageAt?: string | null;
    lastThreadMessagePreview?: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

function formatTimecode(seconds: number | null): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds as number)) : 0;
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function formatDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function WorkspaceDemoReviewPageClient({
  token,
  projectId,
  versionId,
}: {
  token: string;
  projectId: string;
  versionId: string;
}): JSX.Element {
  const playerRef = useRef<KinescopePlayerRef>(null);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const [threadCache, setThreadCache] = useState<Record<string, FeedbackThreadMessageResponse[]>>({});
  const [threadLoadingId, setThreadLoadingId] = useState<string | null>(null);

  const { data, isLoading, error } = useSWR(
    `/api/public/workspace-demo/${token}/projects/${projectId}?versionId=${versionId}`,
    apiFetch<WorkspaceDemoProjectDetailResponse>,
  );

  const activeVersion = useMemo(
    () => data?.versions.find((item) => item.id === (data.activeVersionId ?? versionId)) ?? null,
    [data, versionId],
  );

  const selectedFeedback = useMemo(
    () => data?.feedback.find((item) => item.id === selectedFeedbackId) ?? null,
    [data, selectedFeedbackId],
  );

  const handleFeedbackClick = async (feedbackId: string, timecodeSec: number | null): Promise<void> => {
    setSelectedFeedbackId(feedbackId);
    playerRef.current?.seekTo(Number.isFinite(timecodeSec) ? Math.max(0, timecodeSec as number) : 0);
    playerRef.current?.pause();

    if (threadCache[feedbackId] || threadLoadingId === feedbackId) {
      return;
    }

    setThreadLoadingId(feedbackId);
    try {
      const messages = await apiFetch<FeedbackThreadMessageResponse[]>(
        `/api/public/workspace-demo/${token}/feedback/${feedbackId}/thread`,
      );
      setThreadCache((current) => ({ ...current, [feedbackId]: messages }));
    } finally {
      setThreadLoadingId((current) => (current === feedbackId ? null : current));
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_38%),linear-gradient(180deg,#020617,#0f172a)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_26px_80px_rgba(2,6,23,0.5)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Link
                href={`/workspace-demo/${token}`}
                className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Назад к проектам
              </Link>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-100">
                <Lock className="h-3.5 w-3.5" />
                Internal workspace demo
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-slate-400">{data?.workspace.name ?? "Workspace demo"}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">{data?.project.name ?? "Project review"}</h1>
                <p className="mt-2 text-sm text-slate-300">
                  Клиент: {data?.project.client.name ?? "Загрузка..."} · Read-only обзор внутреннего review-потока.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Клиентский портал</div>
                <div className="mt-1 truncate font-medium text-slate-100">
                  {data?.project.portalToken ? `/client-portal/${data.project.portalToken}` : "Скоро"}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Режим</div>
                <div className="mt-1 font-medium text-slate-100">Только просмотр</div>
              </div>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.9fr)]">
            <Card className="border-white/10 bg-white/[0.04]">
              <CardContent className="space-y-4 p-6">
                <div className="h-8 w-1/3 animate-pulse rounded bg-white/10" />
                <div className="aspect-video animate-pulse rounded-3xl bg-white/10" />
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/[0.04]">
              <CardContent className="space-y-3 p-6">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`demo-feedback-skeleton-${index}`} className="h-24 animate-pulse rounded-2xl bg-white/10" />
                ))}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {error ? (
          <Card className="border-red-400/25 bg-red-500/10 text-red-100">
            <CardContent className="p-6 text-sm">Не удалось открыть demo review workspace.</CardContent>
          </Card>
        ) : null}

        {data && activeVersion ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.9fr)]">
            <section className="space-y-4">
              <Card className="overflow-hidden border-white/10 bg-white/[0.04]">
                <CardContent className="space-y-5 p-4 sm:p-6">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs font-medium text-slate-200">
                        <PlayCircle className="h-3.5 w-3.5" />
                        Версия {activeVersion.versionNumber}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-semibold">{activeVersion.fileName}</h2>
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
                            VERSION_STATUS_BADGE_CLASSES[toVersionUiStatus(activeVersion.status)],
                          )}
                        >
                          {VERSION_STATUS_LABELS[toVersionUiStatus(activeVersion.status)]}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-slate-400">
                      Загружено {formatDateTime(activeVersion.createdAt)} · {activeVersion.uploadedBy.name}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black">
                    <KinescopePlayer
                      ref={playerRef}
                      videoId={activeVersion.kinescopeVideoId}
                      videoUrl={activeVersion.streamUrl ?? activeVersion.fileUrl}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {data.versions.map((version) => (
                      <Link
                        key={version.id}
                        href={`/workspace-demo/${token}/projects/${projectId}/versions/${version.id}`}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition",
                          version.id === activeVersion.id
                            ? "border-sky-300/35 bg-sky-300/12 text-sky-100"
                            : "border-white/10 bg-slate-950/40 text-slate-300 hover:border-white/20 hover:text-white",
                        )}
                      >
                        v{version.versionNumber}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            <aside className="space-y-4">
              <Card className="border-white/10 bg-white/[0.04]">
                <CardContent className="space-y-4 p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">Правки клиента</h2>
                      <p className="text-sm text-slate-400">Открывают нужный таймкод и тред, но без возможности что-либо менять.</p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-xs font-medium text-slate-200">
                      {data.feedback.length}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {data.feedback.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void handleFeedbackClick(item.id, item.timecodeSec)}
                        className={cn(
                          "w-full rounded-2xl border p-4 text-left transition",
                          selectedFeedbackId === item.id
                            ? "border-sky-300/30 bg-sky-300/10"
                            : "border-white/10 bg-slate-950/30 hover:border-white/20 hover:bg-slate-950/50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-slate-100">{item.text}</div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <span>{item.author.name}</span>
                              <span>•</span>
                              <span>{formatTimecode(item.timecodeSec)}</span>
                              <span>•</span>
                              <span>{FEEDBACK_STATUS_LABELS[item.status]}</span>
                            </div>
                          </div>
                          <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300">
                            {item.threadMessageCount ?? 0} сообщений
                          </div>
                        </div>
                        {item.lastThreadMessagePreview ? (
                          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                            Последний ответ: {item.lastThreadMessagePreview}
                          </div>
                        ) : null}
                      </button>
                    ))}

                    {data.feedback.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">
                        На этой версии пока нет клиентских правок.
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/[0.04]">
                <CardContent className="space-y-4 p-4 sm:p-6">
                  <div className="flex items-center gap-2">
                    <MessageSquareQuote className="h-4 w-4 text-slate-300" />
                    <h3 className="text-base font-semibold">Тред правки</h3>
                  </div>

                  {selectedFeedback ? (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                        <div className="text-sm font-medium text-slate-100">{selectedFeedback.text}</div>
                        <div className="mt-2 text-xs text-slate-400">
                          {selectedFeedback.author.name} · {formatTimecode(selectedFeedback.timecodeSec)}
                        </div>
                      </div>

                      {threadLoadingId === selectedFeedback.id ? (
                        <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-6 text-sm text-slate-400">
                          Загружаю переписку...
                        </div>
                      ) : null}

                      {(threadCache[selectedFeedback.id] ?? []).length > 0 ? (
                        <div className="space-y-3">
                          {(threadCache[selectedFeedback.id] ?? []).map((message) => (
                            <div key={message.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                              <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                                <span>{message.author.name}</span>
                                <span>{formatDateTime(message.createdAt)}</span>
                              </div>
                              <div className="mt-2 text-sm text-slate-100">{message.text}</div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {threadLoadingId !== selectedFeedback.id && (threadCache[selectedFeedback.id] ?? []).length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                          В этом треде пока нет ответов.
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">
                      Выбери правку справа, чтобы увидеть её обсуждение и перейти к нужному месту в видео.
                    </div>
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>
        ) : null}
      </div>
    </main>
  );
}
