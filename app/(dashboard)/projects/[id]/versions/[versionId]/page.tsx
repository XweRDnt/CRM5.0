"use client";

import useSWR from "swr";
import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, Copy, Loader2, Plus, Search, Send, Share2, Users } from "lucide-react";
import type { FeedbackStatus } from "@prisma/client";
import { useDashboardUser } from "@/components/auth/dashboard-user-context";
import { KinescopePlayer, type KinescopePlayerRef } from "@/components/video/KinescopePlayer";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { toast } from "@/components/ui/toast";
import { VersionUploadDialog } from "@/components/versions/VersionUploadDialog";
import { useDemoProjectOverlay } from "@/lib/hooks/use-demo-project-overlay";
import { apiFetch } from "@/lib/utils/client-api";
import { cn } from "@/lib/utils/cn";
import { appendDemoProjectThreadMessage, mergeDemoProjectThreadMessages, mergeWorkspaceFeedbackWithDemoOverlay } from "@/lib/utils/demo-project-overlay";
import { getVersionDetailPageState, getVersionMemberRequestKeys } from "@/lib/utils/version-detail-page";
import { getVersionDetailLayoutMode } from "@/lib/utils/version-detail-layout";
import { getVersionLabel } from "@/lib/utils/version-label";
import { canReplyInWorkspaceThread } from "@/lib/utils/workspace-demo-thread";
import { strokeToSvg } from "@/lib/annotations/render";
import { getOverlaySvgProps } from "@/lib/annotations/svg";
import { validateAnnotationData } from "@/lib/annotations/validation";
import { getAnnotationPlaybackPolicy } from "@/lib/annotations/behavior";
import type { AnnotationData, AnnotationStroke, AssetVersionResponse, FeedbackResponse, FeedbackThreadMessageResponse, ProjectResponse } from "@/types";

type ApiWrapped<T> = T | { data: T };
type FeedbackFilter = "all" | "NEW" | "VIEWED" | "IN_PROGRESS" | "RESOLVED";
type ProjectMemberRole = "pm" | "editor";
type WorkspaceMember = {
  userId: string;
  role: string;
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
  roleOnProject: ProjectMemberRole;
};

const STATIC_SWR_OPTIONS = {
  revalidateOnFocus: false,
  revalidateIfStale: false,
} as const;
const EMPTY_FEEDBACK: FeedbackResponse[] = [];
const EMPTY_WORKSPACE_MEMBERS: WorkspaceMember[] = [];
const EMPTY_PROJECT_MEMBERS: ProjectMember[] = [];

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

const FILTER_ACTIVE_CLASSES: Record<FeedbackFilter, string> = {
  all: "border-slate-300/30 bg-[linear-gradient(135deg,rgba(148,163,184,0.2),rgba(71,85,105,0.18))] text-slate-100 shadow-[0_8px_24px_rgba(71,85,105,0.2)]",
  NEW: "border-amber-300/35 bg-[linear-gradient(135deg,rgba(251,191,36,0.24),rgba(245,158,11,0.14))] text-amber-100 shadow-[0_8px_24px_rgba(245,158,11,0.2)]",
  VIEWED: "border-violet-300/35 bg-[linear-gradient(135deg,rgba(129,140,248,0.24),rgba(139,92,246,0.14))] text-violet-100 shadow-[0_8px_24px_rgba(99,102,241,0.22)]",
  IN_PROGRESS: "border-sky-300/35 bg-[linear-gradient(135deg,rgba(56,189,248,0.24),rgba(14,165,233,0.14))] text-sky-100 shadow-[0_8px_24px_rgba(14,165,233,0.22)]",
  RESOLVED: "border-emerald-300/35 bg-[linear-gradient(135deg,rgba(52,211,153,0.22),rgba(16,185,129,0.14))] text-emerald-100 shadow-[0_8px_24px_rgba(16,185,129,0.2)]",
};

const FILTER_IDLE_CLASSES: Record<FeedbackFilter, string> = {
  all: "border-slate-400/18 bg-slate-400/8 text-slate-200/70 hover:border-slate-300/28 hover:bg-slate-300/10 hover:text-slate-100",
  NEW: "border-amber-400/18 bg-amber-400/8 text-amber-100/70 hover:border-amber-300/28 hover:bg-amber-300/10 hover:text-amber-50",
  VIEWED: "border-violet-400/18 bg-violet-400/8 text-violet-100/70 hover:border-violet-300/28 hover:bg-violet-300/10 hover:text-violet-50",
  IN_PROGRESS: "border-sky-400/18 bg-sky-400/8 text-sky-100/70 hover:border-sky-300/28 hover:bg-sky-300/10 hover:text-sky-50",
  RESOLVED: "border-emerald-400/18 bg-emerald-400/8 text-emerald-100/70 hover:border-emerald-300/28 hover:bg-emerald-300/10 hover:text-emerald-50",
};

const FEEDBACK_CARD_CLASSES: Record<FeedbackStatus, string> = {
  NEW: "border-amber-400/14 bg-[linear-gradient(180deg,rgba(20,22,33,0.96),rgba(18,16,12,0.98))] hover:border-amber-300/24",
  VIEWED: "border-violet-400/14 bg-[linear-gradient(180deg,rgba(20,22,33,0.96),rgba(18,16,28,0.98))] hover:border-violet-300/24",
  IN_PROGRESS: "border-sky-400/14 bg-[linear-gradient(180deg,rgba(20,22,33,0.96),rgba(12,18,28,0.98))] hover:border-sky-300/24",
  RESOLVED: "border-emerald-400/14 bg-[linear-gradient(180deg,rgba(20,22,33,0.96),rgba(12,20,18,0.98))] hover:border-emerald-300/24",
  REJECTED: "border-rose-400/14 bg-[linear-gradient(180deg,rgba(20,22,33,0.96),rgba(24,14,18,0.98))] hover:border-rose-300/24",
};

const PROJECT_ROLE_LABELS: Record<ProjectMemberRole, string> = {
  pm: "PM",
  editor: "EDITOR",
};

const DEMO_UPLOAD_UNAVAILABLE_MESSAGE = "Загрузка новой версии недоступна в демо-проекте.";

function unwrap<T>(payload: ApiWrapped<T>): T {
  return "data" in (payload as { data?: T }) ? (payload as { data: T }).data : (payload as T);
}

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

function ThreadDateTime({ value }: { value: string | Date }): JSX.Element {
  const [mounted, setMounted] = useState(false);
  const date = value instanceof Date ? value : new Date(value);
  const dateTime = Number.isNaN(date.getTime()) ? undefined : date.toISOString();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <time dateTime={dateTime} suppressHydrationWarning>
      {mounted ? formatDateTime(value) : ""}
    </time>
  );
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
  const user = useDashboardUser();
  const isOwnerOrPm = !user.isDemo && (user.role === "OWNER" || user.role === "PM");
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false,
  );
  const [employeesModalOpen, setEmployeesModalOpen] = useState(false);
  const { showMobileLayout, showDesktopLayout } = getVersionDetailLayoutMode(isDesktopViewport);
  const { workspaceMembersKey, projectMembersKey } = getVersionMemberRequestKeys({
    isOwnerOrPm,
    employeesModalOpen,
    projectId,
  });

  const { data: project, isLoading: projectLoading, error: projectError } = useSWR(
    `/api/projects/${projectId}`,
    apiFetch<ProjectResponse>,
    STATIC_SWR_OPTIONS,
  );
  const { data: versionsResponse, isLoading: versionsLoading, error: versionsError, mutate: mutateVersions } = useSWR(
    `/api/projects/${projectId}/versions`,
    apiFetch<ApiWrapped<AssetVersionResponse[]>>,
    STATIC_SWR_OPTIONS,
  );
  const {
    data: feedbackResponse = EMPTY_FEEDBACK,
    isLoading: feedbackLoading,
    mutate: mutateFeedback,
  } = useSWR(`/api/projects/${projectId}/feedback`, apiFetch<FeedbackResponse[]>, STATIC_SWR_OPTIONS);
  const { data: workspaceMembers = EMPTY_WORKSPACE_MEMBERS, isLoading: workspaceMembersLoading } = useSWR(
    workspaceMembersKey,
    apiFetch<WorkspaceMember[]>,
    STATIC_SWR_OPTIONS,
  );
  const { data: projectMembers = EMPTY_PROJECT_MEMBERS, mutate: mutateProjectMembers } = useSWR(
    projectMembersKey,
    apiFetch<ProjectMember[]>,
    STATIC_SWR_OPTIONS,
  );

  const versions = useMemo(
    () => (versionsResponse ? [...unwrap(versionsResponse)].sort((a, b) => a.versionNumber - b.versionNumber) : []),
    [versionsResponse],
  );

  const [activeVersionId, setActiveVersionId] = useState<string>(versionId);
  const [activeFilter, setActiveFilter] = useState<FeedbackFilter>("all");
  const [openThreadIds, setOpenThreadIds] = useState<Set<string>>(() => new Set());
  const [threadMessagesById, setThreadMessagesById] = useState<Record<string, FeedbackThreadMessageResponse[]>>({});
  const [threadDrafts, setThreadDrafts] = useState<Record<string, string>>({});
  const [threadLoadingById, setThreadLoadingById] = useState<Record<string, boolean>>({});
  const [threadSubmittingById, setThreadSubmittingById] = useState<Record<string, boolean>>({});
  const [expandedThreadCardIds, setExpandedThreadCardIds] = useState<Record<string, boolean>>({});
  const [xmlExporting, setXmlExporting] = useState(false);
  const [resettingPortalLink, setResettingPortalLink] = useState(false);
  const [deletingVersion, setDeletingVersion] = useState(false);
  const [confirmDeleteVersionOpen, setConfirmDeleteVersionOpen] = useState(false);
  const [activeAnnotation, setActiveAnnotation] = useState<AnnotationData | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [deleteMenuPosition, setDeleteMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<Record<string, ProjectMemberRole>>({});
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
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
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateViewport = (event?: MediaQueryListEvent): void => {
      setIsDesktopViewport(event?.matches ?? mediaQuery.matches);
    };

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => {
      mediaQuery.removeEventListener("change", updateViewport);
    };
  }, []);

  useEffect(() => {
    setActiveAnnotation(null);
  }, [activeVersionId]);

  useEffect(() => {
    setActiveFilter("all");
    setOpenThreadIds(new Set());
    setThreadMessagesById({});
    setThreadDrafts({});
    setThreadLoadingById({});
    setThreadSubmittingById({});
    setDeleteMenuPosition(null);
    setShareMenuOpen(false);
    setEmployeesModalOpen(false);
  }, [activeVersionId]);

  useEffect(() => {
    setMemberRoleDrafts(
      projectMembers.reduce<Record<string, ProjectMemberRole>>((acc, member) => {
        acc[member.userId] = member.roleOnProject;
        return acc;
      }, {}),
    );
  }, [projectMembers]);

  useEffect(() => {
    if (!activeVersionId && versions.length > 0) {
      setActiveVersionId(versions[versions.length - 1].id);
    }
  }, [activeVersionId, versions]);

  const activeVersion = useMemo(
    () => versions.find((version) => version.id === activeVersionId) ?? versions[versions.length - 1],
    [activeVersionId, versions],
  );
  const { overlay: demoOverlay, setOverlay: setDemoOverlay } = useDemoProjectOverlay(project?.id ?? null);
  const mergedFeedbackResponse = useMemo(
    () => (user?.isDemo && activeVersion ? mergeWorkspaceFeedbackWithDemoOverlay(feedbackResponse, demoOverlay, activeVersion.id) : feedbackResponse),
    [activeVersion, demoOverlay, feedbackResponse, user?.isDemo],
  );

  const versionFeedback = useMemo(() => {
    if (!activeVersion) {
      return [];
    }

    return mergedFeedbackResponse
      .filter((item) => item.assetVersionId === activeVersion.id && item.authorType === "CLIENT")
      .sort((a, b) => {
        const byCreatedAt = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (byCreatedAt !== 0) {
          return byCreatedAt;
        }
        return a.id.localeCompare(b.id);
      });
  }, [activeVersion, mergedFeedbackResponse]);

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
  const activeThreadId = Array.from(openThreadIds)[0] ?? null;
  const activeThreadItem = activeThreadId ? filteredFeedback.find((item) => item.id === activeThreadId) ?? null : null;

  const projectMembersByUserId = useMemo(() => {
    return new Map(projectMembers.map((member) => [member.userId, member]));
  }, [projectMembers]);

  const filteredWorkspaceMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) {
      return workspaceMembers;
    }

    return workspaceMembers.filter((member) => {
      const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
      return fullName.includes(query) || member.email.toLowerCase().includes(query);
    });
  }, [memberSearch, workspaceMembers]);

  const playbackPolicy = getAnnotationPlaybackPolicy();
  const overlayStrokes = activeAnnotation?.strokes ?? [];
  const renderStroke = (stroke: AnnotationStroke, index: number): JSX.Element => (
    <g key={`stroke-${index}`} dangerouslySetInnerHTML={{ __html: strokeToSvg(stroke) }} />
  );

  const getActiveKinescopeRef = (): React.RefObject<KinescopePlayerRef | null> => {
    return kinescopeRef;
  };

  const seekToTimecode = (timecodeSec: number | null, annotation: FeedbackResponse["annotationData"]): void => {
    const target = Number.isFinite(timecodeSec) ? Math.max(0, timecodeSec as number) : 0;
    const playerRef = getActiveKinescopeRef();
    playerRef.current?.seekTo(target);
    if (playbackPolicy.pauseOnCommentSelect) {
      playerRef.current?.pause();
    }
    setActiveAnnotation(normalizeAnnotationData(annotation));
  };

  useEffect(() => {
    if (!activeVersion || !user || user.isDemo || feedbackLoading) {
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
  }, [activeVersion, feedbackLoading, mutateFeedback, user, visibleBaseFeedback]);

  const loadThreadMessages = async (feedbackId: string): Promise<void> => {
    if (threadLoadingById[feedbackId]) {
      return;
    }

    setThreadLoadingById((current) => ({ ...current, [feedbackId]: true }));
    try {
      const messages = await apiFetch<FeedbackThreadMessageResponse[]>(`/api/feedback/${feedbackId}/thread`);
      setThreadMessagesById((current) => ({ ...current, [feedbackId]: messages }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить тред");
    } finally {
      setThreadLoadingById((current) => ({ ...current, [feedbackId]: false }));
    }
  };

  const markThreadRead = async (feedbackId: string): Promise<void> => {
    if (user?.isDemo) {
      return;
    }

    try {
      await apiFetch(`/api/feedback/${feedbackId}/thread/read`, { method: "POST" });
      await mutateFeedback(
        (previous) => (previous ?? []).map((item) => (item.id === feedbackId ? { ...item, threadUnreadCount: 0 } : item)),
        { revalidate: false },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось отметить тред прочитанным");
    }
  };

  const toggleThread = async (threadId: string): Promise<void> => {
    const isOpen = openThreadIds.has(threadId);

    setOpenThreadIds(isOpen ? new Set() : new Set([threadId]));

    if (isOpen) {
      return;
    }

    const isLocalDemoFeedback = user?.isDemo && demoOverlay.feedback.some((item) => item.id === threadId);
    if (!threadMessagesById[threadId] && !isLocalDemoFeedback) {
      await loadThreadMessages(threadId);
    }

    if (!isLocalDemoFeedback) {
      await markThreadRead(threadId);
    }
  };

  const handleThreadReply = async (feedbackId: string): Promise<void> => {
    const text = threadDrafts[feedbackId]?.trim() ?? "";
    if (!text || !user) {
      return;
    }

    setThreadSubmittingById((current) => ({ ...current, [feedbackId]: true }));
    try {
      if (user.isDemo) {
        setDemoOverlay((current) =>
          appendDemoProjectThreadMessage(current, {
            feedbackItemId: feedbackId,
            authorType: "USER",
            authorId: user.id,
            authorName: `${user.firstName} ${user.lastName}`.trim() || user.email,
            authorRole: user.role,
            authorEmail: user.email,
            text,
          }).overlay,
        );
        setThreadDrafts((current) => ({ ...current, [feedbackId]: "" }));
        return;
      }

      const message = await apiFetch<FeedbackThreadMessageResponse>(`/api/feedback/${feedbackId}/thread`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setThreadMessagesById((current) => ({
        ...current,
        [feedbackId]: [...(current[feedbackId] ?? []), message],
      }));
      setThreadDrafts((current) => ({ ...current, [feedbackId]: "" }));
      await mutateFeedback(
        (previous) =>
          (previous ?? []).map((item) =>
            item.id === feedbackId
              ? {
                  ...item,
                  threadMessageCount: (item.threadMessageCount ?? 0) + 1,
                  lastThreadMessageAt: message.createdAt,
                  lastThreadMessagePreview: message.text,
                }
              : item,
          ),
        { revalidate: false },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось отправить сообщение");
    } finally {
      setThreadSubmittingById((current) => ({ ...current, [feedbackId]: false }));
    }
  };

  const handleXmlExport = async (): Promise<void> => {
    if (!activeVersion || xmlExporting) {
      return;
    }

    setXmlExporting(true);
    try {
      await apiFetch(`/api/projects/${projectId}/versions/${activeVersion.id}/xml-export`, {
        method: "POST",
      });
      await mutateFeedback(
        (previous) =>
          (previous ?? []).map((item) =>
            item.assetVersionId === activeVersion.id && item.status !== "RESOLVED" ? { ...item, status: "IN_PROGRESS" } : item,
          ),
        { revalidate: false },
      );
      toast.success("Правки переведены в работу");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось подготовить XML");
    } finally {
      setXmlExporting(false);
    }
  };

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
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
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
      setConfirmDeleteVersionOpen(false);
    }
  };

  const handleProjectMemberSave = async (userId: string): Promise<void> => {
    const roleOnProject = memberRoleDrafts[userId] ?? projectMembersByUserId.get(userId)?.roleOnProject ?? "editor";
    setSavingMemberId(userId);
    try {
      await apiFetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        body: JSON.stringify({ userIds: [userId], roleOnProject }),
      });
      await mutateProjectMembers();
      toast.success(projectMembersByUserId.has(userId) ? "Роль сотрудника обновлена" : "Сотрудник добавлен в проект");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить сотрудника");
    } finally {
      setSavingMemberId(null);
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
        setEmployeesModalOpen(false);
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

  const canReply = canReplyInWorkspaceThread(user);
  const activeThreadMessages =
    activeThreadItem === null
      ? []
      : user?.isDemo
        ? mergeDemoProjectThreadMessages(threadMessagesById[activeThreadItem.id] ?? [], demoOverlay, activeThreadItem.id)
        : (threadMessagesById[activeThreadItem.id] ?? []);
  const publicPortalLink = project?.portalToken ? createPublicPortalLink(project.portalToken) : "";

  const feedbackListContent = (
    <>
      {feedbackLoading ? <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/45">Загрузка правок...</div> : null}

      {!feedbackLoading && !activeThreadItem && filteredFeedback.length === 0 ? (
        <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/45">
          Правок пока нет
        </div>
      ) : activeThreadItem ? (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {(() => {
            const isExpanded = expandedThreadCardIds[activeThreadItem.id] ?? false;
            const hasLongText = activeThreadItem.text.trim().length > 180;
            const status = (activeThreadItem.status ?? "NEW") as FeedbackStatus;

            return (
              <>
                <div className="mb-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenThreadIds(new Set())}
                    aria-label="Назад к списку"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/72 transition hover:border-white/15 hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                </div>

                <div
                  className={cn(
                    "overflow-hidden rounded-[24px] border p-3.5",
                    FEEDBACK_CARD_CLASSES[status],
                    !isExpanded && hasLongText && "h-[176px] overflow-hidden",
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="min-w-[104px] text-[13px] font-semibold tracking-[0.01em] text-white/92">{activeThreadItem.author.name}</span>
                    <button
                      type="button"
                      onClick={() => seekToTimecode(activeThreadItem.timecodeSec, activeThreadItem.annotationData)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-bold",
                        activeThreadItem.timecodeSec !== null
                          ? "border-sky-300/15 bg-sky-400/10 text-sky-100"
                          : "border-white/10 bg-white/[0.04] text-white/35",
                      )}
                    >
                      {activeThreadItem.timecodeSec !== null ? formatTimecode(activeThreadItem.timecodeSec) : "Без таймкода"}
                    </button>
                  </div>
                  {activeThreadItem.annotationData ? (
                    <div className="mb-2 flex">
                      <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/10 bg-sky-400/8 px-2 py-0.5 text-[10px] text-sky-200/82">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
                        С аннотацией
                      </span>
                    </div>
                  ) : null}
                  <p className={cn("text-sm leading-6 text-white/72", !isExpanded && hasLongText && "line-clamp-3")}>{activeThreadItem.text}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold", STATUS_BADGE_CLASSES[status])}>
                      {STATUS_BADGE_LABELS[status]}
                    </span>
                  </div>
                  {hasLongText ? (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        aria-label={isExpanded ? "Свернуть текст правки" : "Раскрыть текст правки"}
                        onClick={() =>
                          setExpandedThreadCardIds((current) => ({
                            ...current,
                            [activeThreadItem.id]: !isExpanded,
                          }))
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/72 transition hover:border-white/15 hover:text-white"
                      >
                        <ChevronDown className={cn("h-4 w-4 transition", isExpanded && "rotate-180")} />
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.05] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl">
                  <div className="mb-3 shrink-0 text-[10px] uppercase tracking-[0.16em] text-white/28">Обсуждение</div>
                  <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
                    {threadLoadingById[activeThreadItem.id] ? <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-6 text-white/55 backdrop-blur-xl">Загрузка обсуждения...</p> : null}
                    {!threadLoadingById[activeThreadItem.id] && activeThreadMessages.length === 0 ? (
                      <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-6 text-white/55 backdrop-blur-xl">Обсуждение ещё не начато.</p>
                    ) : null}
                    {activeThreadMessages.map((message) => {
                      const isMine = message.authorType === "USER";
                      return (
                        <div key={message.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                          <div
                            className={cn(
                              "max-w-[84%] rounded-[20px] px-3.5 py-3",
                              isMine
                                ? "border border-white/10 bg-[linear-gradient(135deg,rgba(67,87,255,0.34),rgba(56,189,248,0.2))] text-white backdrop-blur-2xl"
                                : "border border-white/10 bg-white/[0.06] text-white/82 backdrop-blur-2xl",
                            )}
                          >
                            <div className={cn("mb-1.5 flex items-center gap-2 text-[10px]", isMine ? "text-white/72" : "text-white/35")}>
                              <span>{isMine ? "Вы" : message.author.name}</span>
                              <ThreadDateTime value={message.createdAt} />
                            </div>
                            <p className="text-[13px] leading-6">{message.text}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 shrink-0 border-t border-white/10 pt-3">
                    {canReply ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={threadDrafts[activeThreadItem.id] ?? ""}
                          onChange={(event) => setThreadDrafts((current) => ({ ...current, [activeThreadItem.id]: event.target.value }))}
                          disabled={threadSubmittingById[activeThreadItem.id]}
                          placeholder="Ответить клиенту..."
                          className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/26"
                        />
                        <button
                          type="button"
                          onClick={() => void handleThreadReply(activeThreadItem.id)}
                          disabled={threadSubmittingById[activeThreadItem.id] || !(threadDrafts[activeThreadItem.id]?.trim())}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-300/20 bg-[linear-gradient(135deg,rgba(67,87,255,0.85),rgba(56,189,248,0.65))] text-white transition disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-white/20"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-white/46">Вы можете просматривать обсуждение, но отвечать в треде может только PM или owner.</div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFeedback.map((item) => {
            const status = (item.status ?? "NEW") as FeedbackStatus;
            return (
              <article
                key={item.id}
                onClick={() => void toggleThread(item.id)}
                className={cn(
                  "overflow-hidden rounded-[24px] border transition cursor-pointer",
                  FEEDBACK_CARD_CLASSES[status],
                  "hover:border-white/18",
                )}
              >
                <div className="relative flex gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-semibold tracking-[0.01em] text-white">{item.author.name}</span>
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
                    {item.annotationData ? (
                      <div className="mb-2 flex">
                        <span className="inline-flex items-center gap-2 px-0 py-0 text-[10px] text-sky-200/82">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
                          С аннотацией
                        </span>
                      </div>
                    ) : null}

                    <p className="text-sm leading-6 text-white/94">{item.text}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold", STATUS_BADGE_CLASSES[status])}>
                        {STATUS_BADGE_LABELS[status]}
                      </span>
                    </div>
                  </div>

                  <div className="mt-1 flex shrink-0 items-center gap-3">
                    {(item.threadUnreadCount ?? 0) > 0 ? <span className="h-2.5 w-2.5 rounded-full bg-indigo-300 shadow-[0_0_18px_rgba(165,180,252,0.85)]" /> : null}
                    <ChevronDown className="h-4 w-4 text-white/30" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );

  const pageState = getVersionDetailPageState({
    projectLoading,
    versionsLoading,
    hasProject: Boolean(project),
    projectErrorMessage: projectError instanceof Error ? projectError.message : null,
    versionsErrorMessage: versionsError instanceof Error ? versionsError.message : null,
  });

  if (pageState.kind === "loading") {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-white/10 bg-[#09090f] py-10 text-white">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-300" />
      </div>
    );
  }

  if (pageState.kind === "error") {
    return (
      <div className="rounded-2xl border border-rose-400/20 bg-[#09090f] px-6 py-8 text-center text-sm text-rose-100/90">
        <p>{pageState.message}</p>
        <button
          type="button"
          className="mt-4 inline-flex rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs font-semibold text-white/90 transition hover:bg-white/10"
          onClick={() => router.refresh()}
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-2xl border border-rose-400/20 bg-[#09090f] px-6 py-8 text-center text-sm text-rose-100/90">
        <p>Не удалось загрузить проект.</p>
      </div>
    );
  }

  const resolvedProject = project;

  if (!activeVersion) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#09090f] py-8 text-center text-sm text-white/60">Версия не найдена.</div>
    );
  }

  return (
    <main className="pm-etalon min-h-[100dvh] overflow-x-hidden text-white lg:h-[100dvh] lg:overflow-hidden">
      <div className="mx-auto flex min-h-full w-full max-w-[1760px] flex-col gap-3 px-4 py-4 lg:h-full lg:min-h-0 xl:px-6 xl:py-5">
        <section className="shrink-0 rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:px-6">
          {showMobileLayout ? (
            <div className="lg:hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 pt-1">
                  <h1 className="truncate text-[clamp(22px,6vw,30px)] font-bold leading-none tracking-[-0.04em]">{resolvedProject.name}</h1>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    ref={shareButtonRef}
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] text-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    onClick={() => {
                      setEmployeesModalOpen(false);
                      setShareMenuOpen((current) => !current);
                    }}
                    aria-label="Поделиться"
                  >
                    <Share2 className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  </button>
                  {isOwnerOrPm ? (
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] text-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      onClick={() => {
                        setShareMenuOpen(false);
                        setEmployeesModalOpen(true);
                      }}
                      aria-label="Сотрудники"
                    >
                      <Users className="h-[18px] w-[18px]" strokeWidth={2.2} />
                    </button>
                  ) : null}
                  <VersionUploadDialog
                    projectId={projectId}
                    triggerText=""
                    triggerClassName="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-indigo-300/35 bg-[linear-gradient(135deg,rgba(67,87,255,0.34),rgba(56,189,248,0.18))] text-white shadow-[0_10px_24px_rgba(67,87,255,0.18)]"
                    triggerContent={<Plus className="h-[24px] w-[24px]" strokeWidth={3.2} />}
                    unavailableMessage={user.isDemo ? DEMO_UPLOAD_UNAVAILABLE_MESSAGE : undefined}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {showDesktopLayout ? (
            <div className="hidden flex-col gap-3 xl:flex-row xl:items-center xl:justify-between lg:flex">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-[clamp(24px,2.4vw,32px)] font-bold leading-none tracking-[-0.04em]">{resolvedProject.name}</h1>
                </div>
              </div>

              <div className="relative flex flex-wrap gap-2 xl:justify-end">
                <button
                  ref={shareButtonRef}
                  type="button"
                  aria-label="Поделиться"
                  className="pm-btn pm-btn-muted inline-flex h-12 w-12 items-center justify-center px-0"
                  onClick={() => {
                    setEmployeesModalOpen(false);
                    setShareMenuOpen((current) => !current);
                  }}
                >
                  <Share2 className="h-[22px] w-[22px]" strokeWidth={2.35} />
                </button>
                {isOwnerOrPm ? (
                  <button
                    type="button"
                    aria-label="Сотрудники"
                    className="pm-btn pm-btn-muted hidden h-12 w-12 items-center justify-center px-0 lg:inline-flex"
                    onClick={() => {
                      setShareMenuOpen(false);
                      setEmployeesModalOpen(true);
                    }}
                  >
                    <Users className="h-[22px] w-[22px]" strokeWidth={2.35} />
                  </button>
                ) : null}
                <VersionUploadDialog
                  projectId={projectId}
                  triggerText="+ Новая версия"
                  triggerClassName="pm-btn inline-flex h-12 items-center justify-center px-5 text-[14px] font-semibold"
                  unavailableMessage={user.isDemo ? DEMO_UPLOAD_UNAVAILABLE_MESSAGE : undefined}
                />
              </div>
            </div>
          ) : null}
        </section>

        {showDesktopLayout ? (
        <section className="hidden shrink-0 rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:block">
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
                  {getVersionLabel(version)}
                </button>
              );
            })}
          </div>
        </section>
        ) : null}

        {showMobileLayout ? (
        <section className={cn("space-y-3 pb-8 lg:hidden", activeThreadItem && "hidden")}>
          <div className="rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] px-3 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {versions.map((version) => {
                const isActive = version.id === activeVersion.id;
                return (
                  <button
                    key={version.id}
                    type="button"
                    className={cn(
                      "shrink-0 rounded-full border px-4 py-2 text-[12px] font-semibold whitespace-nowrap transition",
                      isActive
                        ? "border-indigo-300/35 bg-[linear-gradient(135deg,rgba(67,87,255,0.2),rgba(56,189,248,0.12))] text-indigo-100"
                        : "border-white/10 bg-white/[0.03] text-white/52 hover:border-white/15 hover:text-white/80",
                    )}
                    onClick={() => setActiveVersionId(version.id)}
                    onContextMenu={(event) => handleVersionContextMenu(event, version.id)}
                    onPointerDown={(event) => handleVersionPointerDown(event, version.id)}
                    onPointerUp={clearLongPressTimer}
                    onPointerCancel={clearLongPressTimer}
                    onPointerLeave={clearLongPressTimer}
                  >
                    {getVersionLabel(version)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="relative aspect-video overflow-hidden rounded-[20px] border border-white/10 bg-[#05070d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_26px_60px_rgba(0,0,0,0.42)]">
              {!isDesktopViewport ? (
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
              ) : null}
              {overlayStrokes.length > 0 ? (
                <div className="pointer-events-none absolute inset-0">
                  <svg {...getOverlaySvgProps()} className="h-full w-full">
                    <defs>
                      <marker id="arrowhead-mobile" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
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
                    className="pointer-events-auto absolute right-3 top-3 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_10px_20px_rgba(0,0,0,0.25)] backdrop-blur"
                  >
                    Скрыть аннотацию
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-4">
            <div className="rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] px-3 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
              <div className="text-[9px] uppercase tracking-[0.14em] text-white/35">Новые</div>
              <div className="mt-1 text-[18px] font-semibold leading-none tracking-[-0.05em] text-amber-300">{feedbackCounts.NEW}</div>
            </div>
            <div className="rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] px-3 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
              <div className="text-[9px] uppercase tracking-[0.14em] text-white/35">Просмотрено</div>
              <div className="mt-1 text-[18px] font-semibold leading-none tracking-[-0.05em] text-white/80">{feedbackCounts.VIEWED}</div>
            </div>
            <div className="rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] px-3 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
              <div className="text-[9px] uppercase tracking-[0.14em] text-white/35">В работе</div>
              <div className="mt-1 text-[18px] font-semibold leading-none tracking-[-0.05em] text-sky-300">{feedbackCounts.IN_PROGRESS}</div>
            </div>
            <div className="rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] px-3 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
              <div className="text-[9px] uppercase tracking-[0.14em] text-white/35">Готово</div>
              <div className="mt-1 text-[18px] font-semibold leading-none tracking-[-0.05em] text-emerald-300">{feedbackCounts.RESOLVED}</div>
            </div>
          </div>

          <div className="rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] p-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <button
              type="button"
              onClick={() => void handleXmlExport()}
              disabled={xmlExporting}
              className="inline-flex items-center gap-2 rounded-[11px] border border-indigo-300/20 bg-[linear-gradient(135deg,rgba(52,65,202,0.22),rgba(56,189,248,0.12))] px-3.5 py-2 text-[13px] font-semibold text-indigo-100"
            >
              Взять в работу
            </button>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            {!activeThreadItem ? (
              <>
                <div className="flex items-start justify-between gap-3 pb-3">
                  <div>
                    <span className="text-[11px] uppercase tracking-[0.16em] text-[#8fa4d48f]">Review inbox</span>
                    <h2 className="mt-1.5 text-[20px] font-semibold tracking-[-0.03em]">
                      Правки <span className="font-medium text-white/35">({visibleBaseFeedback.length})</span>
                    </h2>
                  </div>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
                  {(Object.keys(FILTER_LABELS) as FeedbackFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActiveFilter(filter)}
                      className={cn(
                        "rounded-full border px-3 py-2 text-[11px] font-semibold whitespace-nowrap transition",
                        activeFilter === filter ? FILTER_ACTIVE_CLASSES[filter] : FILTER_IDLE_CLASSES[filter],
                      )}
                    >
                      {FILTER_LABELS[filter]}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {feedbackListContent}
          </div>
        </section>
        ) : null}

        {showMobileLayout && activeThreadItem ? (
          <div className="fixed inset-0 z-50 flex flex-col bg-[radial-gradient(ellipse_at_top,rgba(80,70,210,0.18),transparent_42%),#09090f] backdrop-blur-xl lg:hidden">
            {(() => {
              const isExpanded = expandedThreadCardIds[activeThreadItem.id] ?? false;
              const hasLongText = activeThreadItem.text.trim().length > 180;
              const status = (activeThreadItem.status ?? "NEW") as FeedbackStatus;

              return (
                <>
                  <div className="border-b border-white/10 px-4 pb-3 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">Обсуждение правки</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpenThreadIds(new Set())}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/72"
                        aria-label="Закрыть обсуждение"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                    </div>

                    <div
                      className={cn(
                        "mt-3 overflow-hidden rounded-[24px] border p-3.5",
                        FEEDBACK_CARD_CLASSES[status],
                        !isExpanded && hasLongText && "h-[176px] overflow-hidden",
                      )}
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="min-w-[104px] text-[13px] font-semibold tracking-[0.01em] text-white/92">
                          {activeThreadItem.author.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => seekToTimecode(activeThreadItem.timecodeSec, activeThreadItem.annotationData)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-bold",
                            activeThreadItem.timecodeSec !== null
                              ? "border-sky-300/15 bg-sky-400/10 text-sky-100"
                              : "border-white/10 bg-white/[0.04] text-white/35",
                          )}
                        >
                          {activeThreadItem.timecodeSec !== null ? formatTimecode(activeThreadItem.timecodeSec) : "Без таймкода"}
                        </button>
                      </div>
                      {activeThreadItem.annotationData ? (
                        <div className="mb-2 flex">
                          <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/10 bg-sky-400/8 px-2 py-0.5 text-[10px] text-sky-200/82">
                            <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
                            С аннотацией
                          </span>
                        </div>
                      ) : null}
                      <p className={cn("text-sm leading-6 text-white/72", !isExpanded && hasLongText && "line-clamp-3")}>{activeThreadItem.text}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold", STATUS_BADGE_CLASSES[status])}>
                          {STATUS_BADGE_LABELS[status]}
                        </span>
                      </div>
                      {hasLongText ? (
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            aria-label={isExpanded ? "Свернуть текст правки" : "Раскрыть текст правки"}
                            onClick={() =>
                              setExpandedThreadCardIds((current) => ({
                                ...current,
                                [activeThreadItem.id]: !isExpanded,
                              }))
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/72"
                          >
                            <ChevronDown className={cn("h-4 w-4 transition", isExpanded && "rotate-180")} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    <div className="space-y-2">
                      {threadLoadingById[activeThreadItem.id] ? <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/50">Загрузка обсуждения...</div> : null}
                      {!threadLoadingById[activeThreadItem.id] && activeThreadMessages.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/50">Обсуждение ещё не начато.</div>
                      ) : null}
                      {activeThreadMessages.map((message) => {
                        const isMine = message.authorType === "USER";
                        return (
                          <div key={message.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                            <div
                              className={cn(
                                "max-w-[88%] rounded-[18px] px-3 py-2.5",
                                isMine
                                  ? "border border-white/10 bg-[linear-gradient(135deg,rgba(67,87,255,0.34),rgba(56,189,248,0.2))] text-white backdrop-blur-2xl"
                                  : "border border-white/10 bg-white/[0.06] text-white/82 backdrop-blur-2xl",
                              )}
                            >
                              <div className={cn("mb-1 flex items-center gap-2 text-[10px]", isMine ? "text-white/72" : "text-white/35")}>
                                <span>{isMine ? "Вы" : message.author.name}</span>
                                <ThreadDateTime value={message.createdAt} />
                              </div>
                              <p className="text-xs leading-relaxed">{message.text}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-white/10 px-4 py-3">
                    {canReply ? (
                      <div className="flex items-center gap-2 rounded-[20px] border border-white/10 bg-white/[0.05] p-2">
                        <input
                          value={threadDrafts[activeThreadItem.id] ?? ""}
                          onChange={(event) => setThreadDrafts((current) => ({ ...current, [activeThreadItem.id]: event.target.value }))}
                          disabled={threadSubmittingById[activeThreadItem.id]}
                          placeholder="Ответить клиенту..."
                          className="min-w-0 flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-white/24"
                        />
                        <button
                          type="button"
                          onClick={() => void handleThreadReply(activeThreadItem.id)}
                          disabled={threadSubmittingById[activeThreadItem.id] || !(threadDrafts[activeThreadItem.id]?.trim())}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#4F8EF7] text-white disabled:bg-white/[0.06] disabled:text-white/30"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-white/46">
                        Вы можете просматривать обсуждение, но отвечать в треде может только PM или owner.
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        ) : null}

        {showDesktopLayout ? (
        <section className="hidden min-h-0 flex-1 gap-4 overflow-hidden lg:grid xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.9fr)]">
          <div className="left-col flex min-w-0 min-h-0 flex-col gap-3 overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mx-auto w-full max-w-[1040px]">
                <div className="relative aspect-video min-h-[340px] w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#05070d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_26px_60px_rgba(0,0,0,0.42)] xl:min-h-[420px] 2xl:min-h-[470px]">
                  {isDesktopViewport ? (
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
                  ) : null}
                  {overlayStrokes.length > 0 ? (
                    <div className="pointer-events-none absolute inset-0">
                      <svg {...getOverlaySvgProps()} className="h-full w-full">
                        <defs>
                          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
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
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-2.5 xl:grid-cols-4">
              <div className="rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
                <div className="text-[10px] uppercase tracking-[0.14em] text-white/35">Новые</div>
                <div className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.05em] text-amber-300">{feedbackCounts.NEW}</div>
              </div>
              <div className="rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
                <div className="text-[10px] uppercase tracking-[0.14em] text-white/35">Просмотрено</div>
                <div className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.05em] text-white/80">{feedbackCounts.VIEWED}</div>
              </div>
              <div className="rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
                <div className="text-[10px] uppercase tracking-[0.14em] text-white/35">В работе</div>
                <div className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.05em] text-sky-300">{feedbackCounts.IN_PROGRESS}</div>
              </div>
              <div className="rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
                <div className="text-[10px] uppercase tracking-[0.14em] text-white/35">Готово</div>
                <div className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.05em] text-emerald-300">{feedbackCounts.RESOLVED}</div>
              </div>
            </div>

            <div className="shrink-0 rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] p-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <button
                type="button"
                onClick={() => void handleXmlExport()}
                disabled={xmlExporting}
                className="inline-flex items-center gap-2 rounded-[11px] border border-indigo-300/20 bg-[linear-gradient(135deg,rgba(52,65,202,0.22),rgba(56,189,248,0.12))] px-3.5 py-2 text-[13px] font-semibold text-indigo-100"
              >
                Взять в работу
              </button>
              <p className="mt-1.5 text-[10px] leading-tight text-white/36">Все «Новые» и «Просмотренные» можно быстро перевести в производственный контур.</p>
            </div>
          </div>

          <aside className="min-h-0 overflow-hidden">
            <div className="flex h-full min-h-0 flex-col rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.88)_0%,rgba(10,12,20,0.92)_100%)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              {!activeThreadItem ? (
                <>
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
                          activeFilter === filter ? FILTER_ACTIVE_CLASSES[filter] : FILTER_IDLE_CLASSES[filter],
                        )}
                      >
                        {FILTER_LABELS[filter]}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              <div className={cn("min-h-0 flex-1", activeThreadItem ? "overflow-hidden" : "overflow-y-auto pr-1")}>{feedbackListContent}</div>
            </div>
          </aside>
        </section>
        ) : null}
      </div>
      {shareMenuOpen ? (
        <div className="pm-share-modal-backdrop">
          <div ref={shareMenuRef} className="pm-share-modal">
            <div className="pm-share-modal-head">
              <div>
                <span className="pm-share-modal-kicker">Поделиться</span>
                <h2>Публичная ссылка на версию</h2>
              </div>
            </div>

            <div className="pm-share-link-card">
              <button type="button" className="pm-share-link-copy" onClick={() => void handleCopyPublicLink()} aria-label="Скопировать ссылку">
                <Copy className="h-4 w-4" />
              </button>
              <button type="button" className="pm-share-link-value" onClick={handleOpenPublicLink} disabled={!resolvedProject.portalToken}>
                <span>{publicPortalLink || "Ссылка ещё не создана"}</span>
              </button>
            </div>

            <div className="pm-share-modal-actions">
              <button type="button" className="pm-btn pm-btn-muted" onClick={() => setShareMenuOpen(false)}>
                Закрыть
              </button>
              <button type="button" className="pm-btn pm-btn-muted" onClick={() => void handleResetPublicLink()} disabled={resettingPortalLink}>
                {resettingPortalLink ? "Сброс..." : "Сбросить ссылку"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {employeesModalOpen ? (
        <div
          className="pm-share-modal-backdrop"
          onClick={() => setEmployeesModalOpen(false)}
        >
          <div
            className="pm-people-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pm-share-modal-head">
              <div>
                <span className="pm-share-modal-kicker">Сотрудники</span>
                <h2>Добавить сотрудников в проект</h2>
                <p className="pm-people-modal-copy">Выбери участника команды, задай роль на проекте и сохрани доступ.</p>
              </div>
            </div>

            <div className="pm-people-search">
              <Search className="h-4 w-4" />
              <input
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
                placeholder="Поиск по имени или email"
              />
            </div>

            <div className="pm-people-list">
              {workspaceMembersLoading ? (
                <div className="pm-people-empty">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Загружаю сотрудников...</span>
                </div>
              ) : filteredWorkspaceMembers.length === 0 ? (
                <div className="pm-people-empty">Ничего не найдено.</div>
              ) : (
                filteredWorkspaceMembers.map((member) => {
                  const projectMember = projectMembersByUserId.get(member.userId);
                  const draftRole = memberRoleDrafts[member.userId] ?? projectMember?.roleOnProject ?? "editor";
                  const isSaving = savingMemberId === member.userId;
                  const fullName = `${member.firstName} ${member.lastName}`.trim();

                  return (
                    <div key={member.userId} className="pm-person-row">
                      <div className="pm-person-meta">
                        <div className="pm-person-avatar">{(member.firstName[0] ?? member.email[0] ?? "?").toUpperCase()}</div>
                        <div className="min-w-0">
                          <div className="pm-person-name-row">
                            <p className="pm-person-name">{fullName || member.email}</p>
                            {projectMember ? (
                              <span className="pm-person-state">
                                <Check className="h-3.5 w-3.5" />
                                В проекте
                              </span>
                            ) : null}
                          </div>
                          <p className="pm-person-email">{member.email}</p>
                        </div>
                      </div>

                      <div className="pm-person-actions">
                        <div className="pm-role-switcher">
                          {(["pm", "editor"] as ProjectMemberRole[]).map((role) => (
                            <button
                              key={role}
                              type="button"
                              className={cn("pm-role-pill", draftRole === role && "pm-role-pill-active")}
                              onClick={() =>
                                setMemberRoleDrafts((current) => ({
                                  ...current,
                                  [member.userId]: role,
                                }))
                              }
                            >
                              {PROJECT_ROLE_LABELS[role]}
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          className="pm-btn pm-btn-muted pm-person-save"
                          onClick={() => void handleProjectMemberSave(member.userId)}
                          disabled={isSaving}
                        >
                          {isSaving ? "Сохранение..." : projectMember ? "Обновить" : "Добавить"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pm-share-modal-actions">
              <button type="button" className="pm-btn pm-btn-muted" onClick={() => setEmployeesModalOpen(false)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
              setConfirmDeleteVersionOpen(true);
            }}
            disabled={deletingVersion}
          >
            {deletingVersion ? "Удаление..." : "Удалить версию"}
          </button>
        </div>
      ) : null}

      <ConfirmDeleteDialog
        open={confirmDeleteVersionOpen}
        onOpenChange={setConfirmDeleteVersionOpen}
        title="Вы точно уверены?"
        description={activeVersion ? `${getVersionLabel(activeVersion)} будет удалена без возможности восстановления.` : ""}
        loading={deletingVersion}
        confirmLabel="Удалить версию"
        onConfirm={() => void handleDeleteVersion()}
      />

      <style jsx global>{`
        .pm-etalon {
          background:
            radial-gradient(ellipse at 10% 15%, rgba(80, 70, 210, 0.28) 0%, transparent 50%),
            radial-gradient(ellipse at 90% 85%, rgba(180, 60, 120, 0.18) 0%, transparent 48%),
            #09090f;
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
        .pm-share-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 35;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(4, 6, 12, 0.45);
          backdrop-filter: blur(14px);
        }
        .pm-share-modal {
          display: flex;
          flex-direction: column;
          gap: 18px;
          width: min(560px, calc(100vw - 32px));
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: linear-gradient(180deg, rgba(24, 28, 42, 0.72), rgba(10, 12, 20, 0.82));
          padding: 26px;
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.38);
          backdrop-filter: blur(26px) saturate(150%);
        }
        .pm-share-modal-head h2 {
          margin: 6px 0 0;
          font-size: 24px;
          font-weight: 650;
          letter-spacing: -0.03em;
          color: rgba(245, 247, 255, 0.96);
        }
        .pm-share-modal-kicker {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: rgba(160, 182, 228, 0.58);
        }
        .pm-share-link-card {
          display: grid;
          grid-template-columns: 52px minmax(0, 1fr);
          align-items: stretch;
          gap: 10px;
          border-radius: 22px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          padding: 10px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }
        .pm-share-link-copy {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.05);
          color: rgba(242, 246, 255, 0.92);
          transition: 160ms ease;
        }
        .pm-share-link-copy:hover {
          background: rgba(255, 255, 255, 0.09);
        }
        .pm-share-link-value {
          min-width: 0;
          overflow: hidden;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(10, 12, 20, 0.36);
          padding: 14px 16px;
          text-align: left;
          font-size: 13px;
          color: rgba(229, 235, 248, 0.92);
          transition: 160ms ease;
        }
        .pm-share-link-value:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.06);
        }
        .pm-share-link-value span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pm-share-link-value:disabled,
        .pm-share-link-copy:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }
        .pm-share-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        .pm-people-modal {
          display: flex;
          flex-direction: column;
          gap: 18px;
          width: min(760px, calc(100vw - 32px));
          max-height: min(82vh, 860px);
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: linear-gradient(180deg, rgba(24, 28, 42, 0.74), rgba(10, 12, 20, 0.84));
          padding: 26px;
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.38);
          backdrop-filter: blur(26px) saturate(150%);
        }
        .pm-people-modal-copy {
          margin: 8px 0 0;
          font-size: 13px;
          line-height: 1.6;
          color: rgba(214, 221, 235, 0.58);
        }
        .pm-people-search {
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          padding: 0 14px;
          color: rgba(190, 200, 224, 0.55);
        }
        .pm-people-search input {
          width: 100%;
          height: 48px;
          border: 0;
          background: transparent;
          color: rgba(244, 247, 255, 0.96);
          outline: none;
          font-size: 14px;
        }
        .pm-people-search input::placeholder {
          color: rgba(190, 200, 224, 0.34);
        }
        .pm-people-list {
          display: flex;
          min-height: 0;
          flex: 1;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .pm-people-empty {
          display: flex;
          min-height: 120px;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          color: rgba(214, 221, 235, 0.54);
          font-size: 13px;
        }
        .pm-person-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.025));
          padding: 14px;
        }
        .pm-person-meta {
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 12px;
        }
        .pm-person-avatar {
          display: inline-flex;
          height: 42px;
          width: 42px;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          border: 1px solid rgba(129, 140, 248, 0.2);
          background: linear-gradient(135deg, rgba(67, 87, 255, 0.18), rgba(56, 189, 248, 0.14));
          color: rgba(244, 247, 255, 0.96);
          font-size: 14px;
          font-weight: 700;
        }
        .pm-person-name-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
        }
        .pm-person-name {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: rgba(244, 247, 255, 0.96);
        }
        .pm-person-email {
          margin: 3px 0 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
          color: rgba(214, 221, 235, 0.5);
        }
        .pm-person-state {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          border: 1px solid rgba(52, 211, 153, 0.18);
          background: rgba(16, 185, 129, 0.1);
          padding: 4px 9px;
          font-size: 11px;
          font-weight: 600;
          color: rgba(167, 243, 208, 0.94);
        }
        .pm-person-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .pm-role-switcher {
          display: inline-flex;
          gap: 6px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          padding: 4px;
        }
        .pm-role-pill {
          min-width: 78px;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 700;
          color: rgba(214, 221, 235, 0.52);
          transition: 160ms ease;
        }
        .pm-role-pill-active {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.28), rgba(56, 189, 248, 0.16));
          color: rgba(245, 247, 255, 0.96);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }
        .pm-person-save {
          min-width: 108px;
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
        @media (max-width: 900px) {
          .pm-people-modal {
            padding: 20px;
          }
          .pm-person-row {
            flex-direction: column;
            align-items: stretch;
          }
          .pm-person-actions {
            flex-direction: column;
            align-items: stretch;
          }
          .pm-role-switcher {
            width: 100%;
          }
          .pm-role-pill {
            flex: 1;
          }
          .pm-person-save {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}




