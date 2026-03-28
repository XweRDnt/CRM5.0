import { BillingPlanCode } from "@prisma/client";

export type WorkspaceFilter = "all" | "paid" | "free" | "high" | "inactive";

export type AdminWorkspaceListItem = {
  isBlocked: boolean;
  subscription: {
    plan: {
      code: BillingPlanCode;
      maxTrafficGb: number | null;
      maxStorageGb: number | null;
      maxTranscodingMinutes: number | null;
    };
  };
  usage: {
    trafficGb: number;
    storageGb: number;
    transcodingMinutes: number;
  } | null;
};

export function resolveWorkspaceFilter(value: string | null | undefined): WorkspaceFilter {
  switch (value) {
    case "paid":
    case "free":
    case "high":
    case "inactive":
      return value;
    default:
      return "all";
  }
}

function percentage(value: number, limit: number | null): number {
  if (!Number.isFinite(value) || limit === null || !Number.isFinite(limit) || limit <= 0) {
    return 0;
  }

  return (value / limit) * 100;
}

function maxUsagePercent(workspace: AdminWorkspaceListItem): number {
  if (!workspace.usage) {
    return 0;
  }

  const plan = workspace.subscription.plan;
  return Math.max(
    percentage(workspace.usage.trafficGb, plan.maxTrafficGb),
    percentage(workspace.usage.storageGb, plan.maxStorageGb),
    percentage(workspace.usage.transcodingMinutes, plan.maxTranscodingMinutes),
  );
}

export function matchesWorkspaceFilter(workspace: AdminWorkspaceListItem, filter: WorkspaceFilter): boolean {
  switch (filter) {
    case "paid":
      return workspace.subscription.plan.code !== BillingPlanCode.FREE;
    case "free":
      return workspace.subscription.plan.code === BillingPlanCode.FREE;
    case "high":
      return maxUsagePercent(workspace) >= 80;
    case "inactive":
      return !workspace.usage || (
        workspace.usage.trafficGb <= 0 &&
        workspace.usage.storageGb <= 0 &&
        workspace.usage.transcodingMinutes <= 0
      );
    case "all":
    default:
      return true;
  }
}
