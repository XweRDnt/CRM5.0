"use client";

import useSWR from "swr";
import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ProjectStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { useAuthGuard } from "@/lib/hooks/use-auth-guard";
import { apiFetch } from "@/lib/utils/client-api";
import { cn } from "@/lib/utils/cn";
import { VERSION_STATUS_BADGE_CLASSES, VERSION_STATUS_LABELS, toVersionUiStatus, type VersionUiStatus } from "@/lib/constants/status-ui";
import type { AssetVersionResponse, FeedbackResponse, ProjectResponse } from "@/types";

type ApiWrapped<T> = T | { data: T };
type AppTheme = "light" | "dark";

const STATUS_BADGE_STYLES: Record<AppTheme, Record<VersionUiStatus, CSSProperties>> = {
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

type VersionFeedbackStats = {
  totalClient: number;
  newClient: number;
};
type WorkspaceEditor = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
};
type ProjectMember = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  addedAt: string;
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

export default function ProjectDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { user } = useAuthGuard();
  const isOwnerOrPm = user?.role === "OWNER" || user?.role === "PM";
  const [appTheme, setAppTheme] = useState<AppTheme>("light");
  const [resettingPortalLink, setResettingPortalLink] = useState(false);
  const [selectedEditorIds, setSelectedEditorIds] = useState<string[]>([]);

  const { data: project, isLoading: projectLoading } = useSWR(`/api/projects/${projectId}`, apiFetch<ProjectResponse>);
  const { data: versionsResponse, isLoading: versionsLoading } = useSWR(
    `/api/projects/${projectId}/versions`,
    apiFetch<ApiWrapped<AssetVersionResponse[]>>,
  );
  const { data: feedback = [], isLoading: feedbackLoading } = useSWR(
    `/api/projects/${projectId}/feedback`,
    apiFetch<FeedbackResponse[]>,
  );
  const { data: teamEditors = [] } = useSWR(
    isOwnerOrPm ? "/api/team/members" : null,
    apiFetch<WorkspaceEditor[]>,
  );
  const { data: projectMembers = [], mutate: mutateProjectMembers } = useSWR(
    isOwnerOrPm ? `/api/projects/${projectId}/members` : null,
    apiFetch<ProjectMember[]>,
  );

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
  const portalToken = project?.portalToken;
  const projectDisplayStatus =
    latestVersion !== undefined
      ? toVersionUiStatus(latestVersion.status, latestVersionHasFeedback)
      : project
        ? mapProjectToVersionUiStatus(project.status)
        : undefined;

  const handleCopyPublicLink = async (): Promise<void> => {
    if (!portalToken) {
      toast.error("Failed to resolve public portal link");
      return;
    }

    try {
      await copyToClipboard(createPublicPortalLink(portalToken));
      toast.success("Link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleResetPublicLink = async (): Promise<void> => {
    setResettingPortalLink(true);
    try {
      const result = await apiFetch<{ portalToken: string }>(`/api/projects/${projectId}/portal-token/reset`, {
        method: "POST",
      });
      await copyToClipboard(createPublicPortalLink(result.portalToken));
      toast.success("Public link reset and copied");
    } catch {
      toast.error("Failed to reset public link");
    } finally {
      setResettingPortalLink(false);
    }
  };

  const handleToggleEditor = (editorId: string): void => {
    setSelectedEditorIds((current) => (current.includes(editorId) ? current.filter((id) => id !== editorId) : [...current, editorId]));
  };

  const handleAddEditors = async (): Promise<void> => {
    if (selectedEditorIds.length === 0) {
      toast.error("Select at least one editor");
      return;
    }

    try {
      await apiFetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        body: JSON.stringify({ userIds: selectedEditorIds }),
      });
      setSelectedEditorIds([]);
      await mutateProjectMembers();
      toast.success("Editors added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add editors");
    }
  };

  const handleRemoveEditor = async (editorUserId: string): Promise<void> => {
    try {
      await apiFetch(`/api/projects/${projectId}/members/${editorUserId}`, {
        method: "DELETE",
      });
      await mutateProjectMembers();
      toast.success("Editor removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove editor");
    }
  };

  if (projectLoading || !project) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">{project.name}</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{project.client.name}</p>
            {projectDisplayStatus && (
              <span
                className={cn(
                  "inline-flex rounded-full border px-3 py-1 text-xs font-medium tracking-wide",
                  VERSION_STATUS_BADGE_CLASSES[projectDisplayStatus],
                )}
                style={STATUS_BADGE_STYLES[appTheme][projectDisplayStatus]}
              >
                {VERSION_STATUS_LABELS[projectDisplayStatus]}
              </span>
            )}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" onClick={handleCopyPublicLink} disabled={!portalToken} className="w-full sm:w-auto">
              Публичная ссылка
            </Button>
            <Button variant="outline" onClick={handleResetPublicLink} disabled={resettingPortalLink} className="w-full sm:w-auto">
              {resettingPortalLink ? "Reset..." : "Reset link"}
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link href={`/projects/${projectId}/versions/new`}>+ Добавить версию</Link>
            </Button>
          </div>
        </div>
      </section>

      {isOwnerOrPm && (
        <section>
          <Card className="border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900/50">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Участники проекта</h2>
              <div className="space-y-2">
                {(projectMembers ?? []).length === 0 ? (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Пока нет назначенных редакторов.</p>
                ) : (
                  projectMembers.map((member) => (
                    <div key={member.userId} className="flex items-center justify-between rounded-lg border border-neutral-200 p-2.5 dark:border-neutral-700">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400">{member.email}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => void handleRemoveEditor(member.userId)}>
                        Удалить
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Добавить редакторов</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {teamEditors.map((editor) => (
                    <label
                      key={editor.userId}
                      className="flex items-center gap-2 rounded-lg border border-neutral-200 px-2.5 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEditorIds.includes(editor.userId)}
                        onChange={() => handleToggleEditor(editor.userId)}
                      />
                      <span className="truncate">
                        {editor.firstName} {editor.lastName}
                      </span>
                    </label>
                  ))}
                </div>
                <Button onClick={() => void handleAddEditors()} className="w-full sm:w-auto">
                  Добавить в проект
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <section>
        {versionsLoading || feedbackLoading ? (
          <Card className="border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900/50">
            <CardContent className="py-10">
              <div className="flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>
        ) : versions.length === 0 ? (
          <Card className="border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900/50">
            <CardContent className="py-8 text-sm text-neutral-600 dark:text-neutral-400">Пока нет загруженных версий.</CardContent>
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
                <Link
                  key={version.id}
                  href={`/projects/${projectId}/versions/${version.id}`}
                  className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Card
                    className={cn(
                      "border-neutral-200 bg-white transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/50 dark:hover:bg-neutral-900/70",
                      isApproved && "opacity-75",
                    )}
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Версия {version.versionNumber}</p>
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
                                VERSION_STATUS_BADGE_CLASSES[uiStatus],
                              )}
                              style={STATUS_BADGE_STYLES[appTheme][uiStatus]}
                            >
                              {VERSION_STATUS_LABELS[uiStatus]}
                            </span>
                          </div>
                          <p className={cn("text-sm", hasNewFeedback ? "text-red-700 dark:text-red-300" : "text-neutral-600 dark:text-neutral-400")}>
                            {hasNewFeedback ? `${stats.newClient} новых правок от клиента` : `${stats.totalClient} правок`}
                          </p>
                          <p className="text-xs text-neutral-600 dark:text-neutral-500">Загрузил: {version.uploadedBy.name}</p>
                        </div>

                        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-end">
                          <span className="text-xs text-neutral-600 dark:text-neutral-500">{formatVersionDate(version.createdAt)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}


