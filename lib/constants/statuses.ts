export const PROJECT_STATUSES = [
  "draft",
  "in_progress",
  "client_review",
  "completed",
  "on_hold",
  "cancelled",
] as const;

export const FEEDBACK_STATUSES = ["new", "in_progress", "resolved", "rejected"] as const;
export const TASK_STATES = ["todo", "in_progress", "done", "cancelled"] as const;
