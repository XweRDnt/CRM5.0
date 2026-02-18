"use client";

import useSWR from "swr";
import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ProjectStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/utils/client-api";
import { cn } from "@/lib/utils/cn";
import { VERSION_STATUS_BADGE_CLASSES, VERSION_STATUS_LABELS, toVersionUiStatus, type VersionUiStatus } from "@/lib/constants/status-ui";
import type { AssetVersionResponse, FeedbackResponse, ProjectResponse } from "@/types";

type ApiWrapped<T> = T | { data: T };

type VersionFeedbackStats = {
  totalClient: number;
  newClient: number;
};

function unwrap<T>(payload: ApiWrapped<T>): T {
  return "data" in (payload as { data?: T }) ? (payload as { data: T }).data : (payload as T);
}

function mapProjectToVersionUiStatus(projectStatus: ProjectStatus): VersionUiStatus {
  if (projectStatus === "CLIENT_REVIEW") return "IN_REVIEW";
  if (projectStatus === "ON_HOLD") return "CHANGES_REQUESTED";
  if (projectStatus === "COMPLETED") return "APPROVED";
  return "DRAFT";
}

function formatVersionDate(value: Date): string {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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

export default function ProjectDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const { data: project, isLoading: projectLoading } = useSWR(`/api/projects/${projectId}`, apiFetch<ProjectResponse>);
  const { data: versionsResponse, isLoading: versionsLoading } = useSWR(
    `/api/projects/${projectId}/versions`,
    apiFetch<ApiWrapped<AssetVersionResponse[]>>,
  );
  const { data: feedback = [], isLoading: feedbackLoading } = useSWR(
    `/api/projects/${projectId}/feedback`,
    apiFetch<FeedbackResponse[]>,
  );

  const versions = useMemo(
    () => (versionsResponse ? [...unwrap(versionsResponse)].sort((a, b) => b.versionNumber - a.versionNumber) : []),
    [versionsResponse],
  );

  const feedbackStatsByVersion = useMemo(() => {
    return feedback.reduce<Record<string, VersionFeedbackStats>>((acc, item) => {
      if (item.authorType !== "CLIENT") {
        return acc;
      }

      const current = acc[item.assetVersionId] ?? { totalClient: 0, newClient: 0 };
      acc[item.assetVersionId] = {
        totalClient: current.totalClient + 1,
        newClient: current.newClient + (item.status === "NEW" ? 1 : 0),
      };
      return acc;
    }, {});
  }, [feedback]);

  const latestVersion = versions[0];
  const latestVersionHasFeedback = latestVersion ? (feedbackStatsByVersion[latestVersion.id]?.totalClient ?? 0) > 0 : false;
  const projectDisplayStatus =
    latestVersion !== undefined
      ? toVersionUiStatus(latestVersion.status, latestVersionHasFeedback)
      : project
        ? mapProjectToVersionUiStatus(project.status)
        : undefined;

  const handleCopyPublicLink = async (): Promise<void> => {
    if (!latestVersion) {
      toast.error("Сначала добавьте версию");
      return;
    }

    try {
      await copyToClipboard(createPublicPortalLink(latestVersion.id));
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не удалось скопировать ссылку");
    }
  };

  if (projectLoading || !project) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-100">{project.name}</h1>
            <p className="text-sm text-neutral-400">{project.client.name}</p>
            {projectDisplayStatus && (
              <span
                className={cn(
                  "inline-flex rounded-full border px-3 py-1 text-xs font-medium tracking-wide",
                  VERSION_STATUS_BADGE_CLASSES[projectDisplayStatus],
                )}
              >
                {VERSION_STATUS_LABELS[projectDisplayStatus]}
              </span>
            )}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" onClick={handleCopyPublicLink} disabled={!latestVersion}>
              Публичная ссылка
            </Button>
            <Button asChild>
              <Link href={`/projects/${projectId}/versions/new`}>+ Добавить версию</Link>
            </Button>
          </div>
        </div>
      </section>

      <section>
        {versionsLoading || feedbackLoading ? (
          <Card>
            <CardContent className="py-10">
              <div className="flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              </div>
            </CardContent>
          </Card>
        ) : versions.length === 0 ? (
          <Card className="border-neutral-700 bg-neutral-900/40">
            <CardContent className="py-8 text-sm text-neutral-400">Пока нет загруженных версий.</CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {versions.map((version) => {
              const stats = feedbackStatsByVersion[version.id] ?? { totalClient: 0, newClient: 0 };
              const hasClientFeedback = stats.totalClient > 0;
              const hasNewFeedback = stats.newClient > 0;
              const uiStatus = toVersionUiStatus(version.status, hasClientFeedback);
              const isApproved = uiStatus === "APPROVED";

              return (
                <Card
                  key={version.id}
                  className={cn(
                    "border-neutral-700 bg-neutral-900/50 transition-colors hover:bg-neutral-900/70",
                    isApproved && "opacity-70",
                  )}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          <p className="text-xl font-semibold text-neutral-100">Версия {version.versionNumber}</p>
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
                              VERSION_STATUS_BADGE_CLASSES[uiStatus],
                            )}
                          >
                            {VERSION_STATUS_LABELS[uiStatus]}
                          </span>
                        </div>
                        <p className={cn("text-sm", hasNewFeedback ? "text-red-400" : "text-neutral-400")}>
                          {hasNewFeedback ? `${stats.newClient} новых правки от клиента` : `${stats.totalClient} правок`}
                        </p>
                        <p className="text-xs text-neutral-500">Загрузил: {version.uploadedBy.name}</p>
                      </div>

                      <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-end">
                        <span className="text-xs text-neutral-500">{formatVersionDate(version.createdAt)}</span>
                        <Button variant="ghost" asChild className="h-auto px-0 text-sm text-neutral-200 hover:text-white">
                          <Link href={`/projects/${projectId}/versions/${version.id}`}>Открыть {"→"}</Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
