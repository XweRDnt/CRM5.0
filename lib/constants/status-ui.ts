import type { FeedbackStatus, VersionStatus } from "@prisma/client";

export type VersionUiStatus = "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED";
export type EditorFeedbackStatus = "NEW" | "IN_PROGRESS" | "RESOLVED";

export const VERSION_STATUS_LABELS: Record<VersionUiStatus, string> = {
  DRAFT: "Черновик",
  IN_REVIEW: "На проверке",
  CHANGES_REQUESTED: "Есть правки",
  APPROVED: "Утверждена",
};

export const VERSION_STATUS_BADGE_CLASSES: Record<VersionUiStatus, string> = {
  DRAFT:
    "border-neutral-500 bg-neutral-200 text-neutral-950 dark:border-neutral-600 dark:bg-neutral-700/40 dark:text-neutral-100",
  IN_REVIEW:
    "border-amber-500 bg-amber-200 text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/25 dark:text-amber-100",
  CHANGES_REQUESTED:
    "border-red-500 bg-red-200 text-red-950 dark:border-red-500/50 dark:bg-red-500/25 dark:text-red-100",
  APPROVED:
    "border-emerald-500 bg-emerald-200 text-emerald-950 dark:border-emerald-500/50 dark:bg-emerald-500/25 dark:text-emerald-100",
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  NEW: "Новая",
  IN_PROGRESS: "В работе",
  RESOLVED: "Готово",
  REJECTED: "Отклонена",
};

export const EDITOR_FEEDBACK_STATUSES: EditorFeedbackStatus[] = ["NEW", "IN_PROGRESS", "RESOLVED"];

export const FEEDBACK_STATUS_ACTIVE_CLASSES: Record<EditorFeedbackStatus, string> = {
  NEW: "border-red-500 bg-red-200 text-red-950 dark:border-red-500 dark:bg-red-500/25 dark:text-red-100",
  IN_PROGRESS: "border-amber-500 bg-amber-200 text-amber-950 dark:border-amber-500 dark:bg-amber-500/25 dark:text-amber-100",
  RESOLVED:
    "border-emerald-500 bg-emerald-200 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-500/25 dark:text-emerald-100",
};

export function toVersionUiStatus(versionStatus: VersionStatus, hasClientFeedback = false): VersionUiStatus {
  if (versionStatus === "APPROVED" || versionStatus === "FINAL") {
    return "APPROVED";
  }

  if (hasClientFeedback || versionStatus === "CHANGES_REQUESTED") {
    return "CHANGES_REQUESTED";
  }

  if (versionStatus === "IN_REVIEW") {
    return "IN_REVIEW";
  }

  return "DRAFT";
}
