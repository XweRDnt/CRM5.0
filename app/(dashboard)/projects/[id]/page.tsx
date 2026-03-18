"use client";

import useSWR from "swr";
import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ProjectStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { VersionUploadDialog } from "@/components/versions/VersionUploadDialog";
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
  const [deletingProject, setDeletingProject] = useState(false);
  const router = useRouter();

  const { data: project, isLoading: projectLoading } = useSWR(`/api/projects/${projectId}`, apiFetch<ProjectResponse>);
  const { data: versionsResponse, isLoading: versionsLoading, mutate: mutateVersions } = useSWR(
    `/api/projects/${projectId}/versions`,
    apiFetch<ApiWrapped<AssetVersionResponse[]>>,
  );
  const { data: feedback = [], isLoading: feedbackLoading, mutate: mutateFeedback } = useSWR(
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

  const handleOpenPublicLink = (): void => {
    if (!portalToken) {
      toast.error("Failed to resolve public portal link");
      return;
    }

    const url = createPublicPortalLink(portalToken);
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
      toast.success("Public link reset and copied");
    } catch {
      toast.error("Failed to reset public link");
    } finally {
      setResettingPortalLink(false);
    }
  };

  const handleDeleteProject = async (): Promise<void> => {
    const confirmed = window.confirm("РЈРґР°Р»РёС‚СЊ РїСЂРѕРµРєС‚? Р’СЃРµ РІРµСЂСЃРёРё Рё РєРѕРјРјРµРЅС‚Р°СЂРёРё Р±СѓРґСѓС‚ СѓРґР°Р»РµРЅС‹.");
    if (!confirmed) {
      return;
    }

    setDeletingProject(true);
    try {
      await apiFetch(`/api/projects/${projectId}`, { method: "DELETE" });
      toast.success("РџСЂРѕРµРєС‚ СѓРґР°Р»С‘РЅ");
      router.replace("/projects");
    } catch {
      toast.error("РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РїСЂРѕРµРєС‚");
    } finally {
      setDeletingProject(false);
    }
  };
  const handleDeleteVersion = async (versionId: string, versionNumber: number): Promise<void> => {
    const confirmed = window.confirm(`РЈРґР°Р»РёС‚СЊ РІРµСЂСЃРёСЋ ${versionNumber}? Р’СЃРµ РїСЂР°РІРєРё Р±СѓРґСѓС‚ СѓРґР°Р»РµРЅС‹.`);
    if (!confirmed) {
      return;
    }

    try {
      await apiFetch(`/api/projects/${projectId}/versions/${versionId}`, { method: "DELETE" });
      await mutateVersions((prev) => {
        const current = prev ? unwrap(prev as ApiWrapped<AssetVersionResponse[]>) : [];
        const remaining = current.filter((item) => item.id !== versionId);
        if (!prev) {
          return remaining as ApiWrapped<AssetVersionResponse[]>;
        }
        const wrapped = typeof prev === "object" && prev !== null && "data" in (prev as Record<string, unknown>);
        return wrapped ? ({ data: remaining } as ApiWrapped<AssetVersionResponse[]>) : (remaining as ApiWrapped<AssetVersionResponse[]>);
      }, { revalidate: true });
      await mutateFeedback(undefined, { revalidate: true });
      toast.success("Р’РµСЂСЃРёСЏ СѓРґР°Р»РµРЅР°");
    } catch {
      toast.error("РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РІРµСЂСЃРёСЋ");
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
        <Loader2 className="h-6 w-6 animate-spin text-indigo-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
            <p className="text-sm glass-muted">{project.client.name}</p>
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
            <Button variant="outline" onClick={handleCopyPublicLink} disabled={!portalToken} className="w-full sm:w-auto">РџСѓР±Р»РёС‡РЅР°СЏ СЃСЃС‹Р»РєР°</Button>
            <Button variant="outline" onClick={handleOpenPublicLink} disabled={!portalToken} className="w-full sm:w-auto">РћС‚РєСЂС‹С‚СЊ РїРѕСЂС‚Р°Р»</Button>
            <Button variant="outline" onClick={handleResetPublicLink} disabled={resettingPortalLink} className="w-full sm:w-auto">
              {resettingPortalLink ? "Reset..." : "Reset link"}
            </Button>
            <VersionUploadDialog projectId={projectId} triggerText="+ Р”РѕР±Р°РІРёС‚СЊ РІРµСЂСЃРёСЋ" triggerClassName="w-full sm:w-auto" />
            {isOwnerOrPm && (
              <Button
                variant="destructive"
                onClick={() => void handleDeleteProject()}
                disabled={deletingProject}
                className="w-full sm:w-auto"
              >
                {deletingProject ? "РЈРґР°Р»РµРЅРёРµ..." : "РЈРґР°Р»РёС‚СЊ РїСЂРѕРµРєС‚"}
              </Button>
            )}
          </div>
        </div>
      </section>

      {isOwnerOrPm && (
        <section>
          <Card className="glass-card">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <h2 className="text-lg font-semibold ">РЈС‡Р°СЃС‚РЅРёРєРё РїСЂРѕРµРєС‚Р°</h2>
              <div className="space-y-2">
                {(projectMembers ?? []).length === 0 ? (
                  <p className="text-sm glass-muted">РџРѕРєР° РЅРµС‚ РЅР°Р·РЅР°С‡РµРЅРЅС‹С… СЂРµРґР°РєС‚РѕСЂРѕРІ.</p>
                ) : (
                  projectMembers.map((member) => (
                    <div key={member.userId} className="glass-item flex items-center justify-between p-2.5">
                      <div>
                        <p className="text-sm font-medium">Р”РѕР±Р°РІРёС‚СЊ СЂРµРґР°РєС‚РѕСЂРѕРІ</p>
                        <p className="text-xs glass-muted">{member.email}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => void handleRemoveEditor(member.userId)}>
                        РЈРґР°Р»РёС‚СЊ
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Р”РѕР±Р°РІРёС‚СЊ СЂРµРґР°РєС‚РѕСЂРѕРІ</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {teamEditors.map((editor) => (
                    <label
                      key={editor.userId}
                      className="glass-item flex items-center gap-2 px-2.5 py-2 text-sm"
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
                <Button onClick={() => void handleAddEditors()} className="w-full sm:w-auto">Р”РѕР±Р°РІРёС‚СЊ РІ РїСЂРѕРµРєС‚</Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <section>
        {versionsLoading || feedbackLoading ? (
          <Card className="glass-card">
            <CardContent className="py-10">
              <div className="flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-300" />
              </div>
            </CardContent>
          </Card>
        ) : versions.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-8 text-sm glass-muted">РџРѕРєР° РЅРµС‚ Р·Р°РіСЂСѓР¶РµРЅРЅС‹С… РІРµСЂСЃРёР№.</CardContent>
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
                  className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <Card
                    className={cn(
                      "glass-card transition-colors hover:bg-white/5",
                      isApproved && "opacity-75",
                    )}
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <p className="text-xl font-semibold">Р’РµСЂСЃРёСЏ {version.versionNumber}</p>
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
                          <p className={cn("text-sm", hasNewFeedback ? "text-red-300" : "glass-muted")}>
                            {hasNewFeedback ? `${stats.newClient} РЅРѕРІС‹С… РїСЂР°РІРѕРє РѕС‚ РєР»РёРµРЅС‚Р°` : `${stats.totalClient} РїСЂР°РІРѕРє`}
                          </p>
                          <p className="text-xs glass-muted">Р—Р°РіСЂСѓР·РёР»: {version.uploadedBy.name}</p>
                        </div>

                        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-end">
                          {isOwnerOrPm && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void handleDeleteVersion(version.id, version.versionNumber);
                              }}
                            >
                              РЈРґР°Р»РёС‚СЊ
                            </Button>
                          )}
                          <span className="text-xs glass-muted">{formatVersionDate(version.createdAt)}</span>
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



