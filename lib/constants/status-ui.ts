import type { FeedbackStatus, VersionStatus } from "@prisma/client";

export type VersionUiStatus = "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED";
export type EditorFeedbackStatus = "NEW" | "IN_PROGRESS" | "RESOLVED";

export const VERSION_STATUS_LABELS: Record<VersionUiStatus, string> = {
  DRAFT: "Черновик",
  IN_REVIEW: "На review",
  CHANGES_REQUESTED: "Есть правки",
  APPROVED: "Утверждена",
};

export const VERSION_STATUS_BADGE_CLASSES: Record<VersionUiStatus, string> = {
  DRAFT: "border-neutral-600 bg-neutral-700/40 text-neutral-200",
  IN_REVIEW: "border-amber-500/40 bg-amber-500/20 text-amber-200",
  CHANGES_REQUESTED: "border-red-500/40 bg-red-500/20 text-red-200",
  APPROVED: "border-emerald-500/40 bg-emerald-500/20 text-emerald-200",
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  NEW: "Новая",
  IN_PROGRESS: "В работе",
  RESOLVED: "Готово",
  REJECTED: "Отклонена",
};

export const EDITOR_FEEDBACK_STATUSES: EditorFeedbackStatus[] = ["NEW", "IN_PROGRESS", "RESOLVED"];

export const FEEDBACK_STATUS_ACTIVE_CLASSES: Record<EditorFeedbackStatus, string> = {
  NEW: "border-red-500 bg-red-500/20 text-red-200",
  IN_PROGRESS: "border-amber-500 bg-amber-500/20 text-amber-200",
  RESOLVED: "border-emerald-500 bg-emerald-500/20 text-emerald-200",
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
