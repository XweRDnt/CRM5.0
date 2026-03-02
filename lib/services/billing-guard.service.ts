import { WorkspaceSubscriptionEventType } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { APIError } from "@/lib/utils/api-error";
import { kinescopeBillingService } from "@/lib/services/kinescope-billing.service";
import { workspaceSubscriptionService } from "@/lib/services/workspace-subscription.service";

function createLimitError(message: string): APIError {
  return new APIError(402, message, "PLAN_LIMIT_EXCEEDED");
}

function normalizeMetric(value: number | null): number {
  if (value === null || !Number.isFinite(value)) {
    return 0;
  }
  return value;
}

export class BillingGuardService {
  private async appendLimitEvent(input: {
    workspaceId: string;
    workspaceSubscriptionId: string;
    actorUserId?: string;
    message: string;
  }): Promise<void> {
    await prisma.workspaceSubscriptionEvent.create({
      data: {
        workspaceId: input.workspaceId,
        workspaceSubscriptionId: input.workspaceSubscriptionId,
        type: WorkspaceSubscriptionEventType.LIMIT_BLOCKED,
        comment: input.message,
        actorUserId: input.actorUserId ?? null,
      },
    });
  }

  async assertCanCreateProject(tenantId: string): Promise<void> {
    const subscription = await workspaceSubscriptionService.getWorkspaceSubscriptionByTenant(tenantId);
    const limit = subscription.plan.maxProjects;
    if (limit === null) {
      return;
    }

    const count = await prisma.project.count({
      where: { tenantId },
    });

    if (count >= limit) {
      const message = `Project limit reached for current plan (${count}/${limit}). Upgrade plan or increase limits.`;
      await this.appendLimitEvent({
        workspaceId: subscription.workspaceId,
        workspaceSubscriptionId: subscription.subscriptionId,
        message,
      });
      throw createLimitError(message);
    }
  }

  async assertCanAddWorkspaceMember(workspaceId: string): Promise<void> {
    const subscription = await workspaceSubscriptionService.getWorkspaceSubscription(workspaceId);
    const limit = subscription.plan.maxMembers;
    if (limit === null) {
      return;
    }

    const count = await prisma.workspaceMember.count({
      where: { workspaceId },
    });

    if (count >= limit) {
      const message = `Team member limit reached for current plan (${count}/${limit}). Upgrade plan or increase limits.`;
      await this.appendLimitEvent({
        workspaceId,
        workspaceSubscriptionId: subscription.subscriptionId,
        message,
      });
      throw createLimitError(message);
    }
  }

  async assertCanUploadToKinescope(tenantId: string): Promise<void> {
    const workspace = await prisma.workspace.findUnique({
      where: { tenantId },
      select: { id: true },
    });

    if (!workspace) {
      throw new APIError(404, "Workspace not found", "NOT_FOUND");
    }

    const subscription = await workspaceSubscriptionService.getWorkspaceSubscription(workspace.id);
    const limits = subscription.plan;
    if (limits.maxTrafficGb === null && limits.maxStorageGb === null && limits.maxTranscodingMinutes === null) {
      return;
    }

    const snapshot = await kinescopeBillingService.getWorkspaceUsageSnapshot({
      workspaceId: workspace.id,
      from: subscription.currentPeriodStart,
      to: subscription.currentPeriodEnd,
      forceRefresh: false,
    });

    const traffic = normalizeMetric(snapshot.trafficGb);
    const storage = normalizeMetric(snapshot.storageGb);
    const transcoding = normalizeMetric(snapshot.transcodingMinutes);

    if (limits.maxTrafficGb !== null && traffic >= limits.maxTrafficGb) {
      const message = `Traffic limit reached for current plan (${traffic.toFixed(2)} GB / ${limits.maxTrafficGb.toFixed(2)} GB). Uploads are blocked.`;
      await this.appendLimitEvent({
        workspaceId: workspace.id,
        workspaceSubscriptionId: subscription.subscriptionId,
        message,
      });
      throw createLimitError(message);
    }

    if (limits.maxStorageGb !== null && storage >= limits.maxStorageGb) {
      const message = `Storage limit reached for current plan (${storage.toFixed(2)} GB / ${limits.maxStorageGb.toFixed(2)} GB). Uploads are blocked.`;
      await this.appendLimitEvent({
        workspaceId: workspace.id,
        workspaceSubscriptionId: subscription.subscriptionId,
        message,
      });
      throw createLimitError(message);
    }

    if (limits.maxTranscodingMinutes !== null && transcoding >= limits.maxTranscodingMinutes) {
      const message = `Transcoding limit reached for current plan (${transcoding.toFixed(2)} min / ${limits.maxTranscodingMinutes.toFixed(2)} min). Uploads are blocked.`;
      await this.appendLimitEvent({
        workspaceId: workspace.id,
        workspaceSubscriptionId: subscription.subscriptionId,
        message,
      });
      throw createLimitError(message);
    }
  }
}

export const billingGuardService = new BillingGuardService();
