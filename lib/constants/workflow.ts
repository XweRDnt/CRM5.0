import type { WorkflowStageName } from "@prisma/client";

export const DEFAULT_STAGE_SLA: Record<WorkflowStageName, number> = {
  BRIEFING: 24,
  PRODUCTION: 72,
  CLIENT_REVIEW: 48,
  REVISIONS: 48,
  APPROVAL: 24,
  DELIVERY: 24,
  COMPLETED: 0,
};

export const STAGE_ORDER: WorkflowStageName[] = [
  "BRIEFING",
  "PRODUCTION",
  "CLIENT_REVIEW",
  "REVISIONS",
  "APPROVAL",
  "DELIVERY",
  "COMPLETED",
];
