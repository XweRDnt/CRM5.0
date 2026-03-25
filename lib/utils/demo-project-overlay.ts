import type { FeedbackStatus } from "@prisma/client";
import type { AnnotationData, FeedbackResponse, FeedbackThreadMessageResponse } from "@/types";

export type DemoProjectOverlayFeedback = {
  id: string;
  assetVersionId: string;
  authorType: "CLIENT";
  authorName: string;
  authorEmail: string | null;
  text: string;
  status: FeedbackStatus;
  timecodeSec: number | null;
  annotationData: AnnotationData | null;
  createdAt: string;
  updatedAt: string;
};

export type DemoProjectOverlayThreadMessage = {
  id: string;
  feedbackItemId: string;
  authorType: "USER" | "CLIENT";
  authorId?: string;
  authorName: string;
  authorRole: string;
  authorEmail: string | null;
  text: string;
  createdAt: string;
};

export type DemoProjectOverlay = {
  feedback: DemoProjectOverlayFeedback[];
  threadMessages: DemoProjectOverlayThreadMessage[];
};

export const EMPTY_DEMO_PROJECT_OVERLAY: DemoProjectOverlay = {
  feedback: [],
  threadMessages: [],
};

export function getDemoProjectOverlayStorageKey(projectId: string): string {
  return `demo_project_overlay:${projectId}`;
}

export function readDemoProjectOverlay(projectId: string): DemoProjectOverlay {
  if (typeof window === "undefined") {
    return EMPTY_DEMO_PROJECT_OVERLAY;
  }

  try {
    const raw = window.localStorage.getItem(getDemoProjectOverlayStorageKey(projectId));
    if (!raw) {
      return EMPTY_DEMO_PROJECT_OVERLAY;
    }

    const parsed = JSON.parse(raw) as Partial<DemoProjectOverlay> | null;
    return {
      feedback: Array.isArray(parsed?.feedback) ? parsed.feedback.filter(isDemoProjectOverlayFeedback) : [],
      threadMessages: Array.isArray(parsed?.threadMessages) ? parsed.threadMessages.filter(isDemoProjectOverlayThreadMessage) : [],
    };
  } catch {
    return EMPTY_DEMO_PROJECT_OVERLAY;
  }
}

export function writeDemoProjectOverlay(projectId: string, overlay: DemoProjectOverlay): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getDemoProjectOverlayStorageKey(projectId), JSON.stringify(overlay));
}

function isDemoProjectOverlayFeedback(value: unknown): value is DemoProjectOverlayFeedback {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<DemoProjectOverlayFeedback>;
  return typeof item.id === "string" && typeof item.assetVersionId === "string" && typeof item.authorName === "string" && typeof item.text === "string";
}

function isDemoProjectOverlayThreadMessage(value: unknown): value is DemoProjectOverlayThreadMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<DemoProjectOverlayThreadMessage>;
  return typeof item.id === "string" && typeof item.feedbackItemId === "string" && typeof item.authorName === "string" && typeof item.text === "string";
}

export function createDemoProjectFeedback(
  overlay: DemoProjectOverlay,
  input: {
    assetVersionId: string;
    authorName: string;
    authorEmail: string | null;
    text: string;
    timecodeSec: number | null;
    annotationData: AnnotationData | null;
    createdAt?: Date;
  },
): { overlay: DemoProjectOverlay; feedbackId: string } {
  const createdAt = input.createdAt ?? new Date();
  const feedbackId = `demo-feedback-${input.assetVersionId}-${createdAt.getTime()}`;
  const feedback: DemoProjectOverlayFeedback = {
    id: feedbackId,
    assetVersionId: input.assetVersionId,
    authorType: "CLIENT",
    authorName: input.authorName,
    authorEmail: input.authorEmail,
    text: input.text,
    status: "NEW",
    timecodeSec: input.timecodeSec,
    annotationData: input.annotationData,
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
  };

  return {
    feedbackId,
    overlay: {
      ...overlay,
      feedback: [...overlay.feedback, feedback],
    },
  };
}

export function appendDemoProjectThreadMessage(
  overlay: DemoProjectOverlay,
  input: {
    feedbackItemId: string;
    authorType: "USER" | "CLIENT";
    authorId?: string;
    authorName: string;
    authorRole: string;
    authorEmail: string | null;
    text: string;
    createdAt?: Date;
  },
): { overlay: DemoProjectOverlay; messageId: string } {
  const createdAt = input.createdAt ?? new Date();
  const messageId = `demo-thread-${input.feedbackItemId}-${createdAt.getTime()}`;
  const message: DemoProjectOverlayThreadMessage = {
    id: messageId,
    feedbackItemId: input.feedbackItemId,
    authorType: input.authorType,
    authorId: input.authorId,
    authorName: input.authorName,
    authorRole: input.authorRole,
    authorEmail: input.authorEmail,
    text: input.text,
    createdAt: createdAt.toISOString(),
  };

  return {
    messageId,
    overlay: {
      ...overlay,
      threadMessages: [...overlay.threadMessages, message],
    },
  };
}

export function mergePortalFeedbackWithDemoOverlay(
  base: Array<{
    id: string;
    text: string;
    status: FeedbackStatus;
    timecodeSec: number | null;
    annotationData?: AnnotationData | null;
    createdAt: string;
    authorName: string;
    authorEmail: string | null;
    threadMessageCount?: number;
    threadUnreadCount?: number;
    lastThreadMessageAt?: string | null;
    lastThreadMessagePreview?: string | null;
  }>,
  overlay: DemoProjectOverlay,
  versionId: string,
): Array<{
  id: string;
  text: string;
  status: FeedbackStatus;
  timecodeSec: number | null;
  annotationData?: AnnotationData | null;
  createdAt: string;
  authorName: string;
  authorEmail: string | null;
  threadMessageCount?: number;
  threadUnreadCount?: number;
  lastThreadMessageAt?: string | null;
  lastThreadMessagePreview?: string | null;
}> {
  const localFeedback = overlay.feedback
    .filter((item) => item.assetVersionId === versionId)
    .map((item) => ({
      id: item.id,
      text: item.text,
      status: item.status,
      timecodeSec: item.timecodeSec,
      annotationData: item.annotationData,
      createdAt: item.createdAt,
      authorName: item.authorName,
      authorEmail: item.authorEmail,
      threadMessageCount: 0,
      threadUnreadCount: 0,
      lastThreadMessageAt: null,
      lastThreadMessagePreview: null,
    }));

  const merged = [...base, ...localFeedback];
  return merged.map((item) => applyThreadMeta(item, overlay.threadMessages.filter((message) => message.feedbackItemId === item.id), false));
}

export function mergeWorkspaceFeedbackWithDemoOverlay(base: FeedbackResponse[], overlay: DemoProjectOverlay, versionId: string): FeedbackResponse[] {
  const localFeedback: FeedbackResponse[] = overlay.feedback
    .filter((item) => item.assetVersionId === versionId)
    .map((item) => ({
      id: item.id,
      assetVersionId: item.assetVersionId,
      authorType: "CLIENT",
      author: {
        name: item.authorName,
        email: item.authorEmail ?? undefined,
      },
      timecodeSec: item.timecodeSec,
      text: item.text,
      category: null,
      status: item.status,
      annotationData: item.annotationData,
      threadMessageCount: 0,
      threadUnreadCount: 0,
      lastThreadMessageAt: null,
      lastThreadMessagePreview: null,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    }));

  const merged = [...base, ...localFeedback];
  return merged.map((item) =>
    applyThreadMeta(item, overlay.threadMessages.filter((message) => message.feedbackItemId === item.id), true),
  );
}

function applyThreadMeta<T extends {
  threadMessageCount?: number;
  threadUnreadCount?: number;
  lastThreadMessageAt?: string | Date | null;
  lastThreadMessagePreview?: string | null;
}>(item: T, localMessages: DemoProjectOverlayThreadMessage[], workspaceDates: boolean): T {
  if (localMessages.length === 0) {
    return item;
  }

  const sorted = [...localMessages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const last = sorted[sorted.length - 1];
  return {
    ...item,
    threadMessageCount: (item.threadMessageCount ?? 0) + sorted.length,
    lastThreadMessageAt: workspaceDates ? new Date(last.createdAt) : last.createdAt,
    lastThreadMessagePreview: last.text,
  };
}

export function mergeDemoProjectThreadMessages(
  base: FeedbackThreadMessageResponse[],
  overlay: DemoProjectOverlay,
  feedbackId: string,
): FeedbackThreadMessageResponse[] {
  const localMessages: FeedbackThreadMessageResponse[] = overlay.threadMessages
    .filter((item) => item.feedbackItemId === feedbackId)
    .map((item) => ({
      id: item.id,
      feedbackItemId: item.feedbackItemId,
      authorType: item.authorType,
      author: {
        id: item.authorId,
        name: item.authorName,
        role: item.authorRole,
        email: item.authorEmail ?? undefined,
      },
      text: item.text,
      createdAt: new Date(item.createdAt),
    }));

  const seen = new Set<string>();
  return [...base, ...localMessages]
    .filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
