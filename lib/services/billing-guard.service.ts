import { WorkspaceSubscriptionEventType } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { APIError } from "@/lib/utils/api-error";
import { kinescopeBillingService } from "@/lib/services/kinescope-billing.service";
import { workspaceSubscriptionService } from "@/lib/services/workspace-subscription.service";

const DECIMAL_BYTES_PER_GB = 1_000_000_000;

function createLimitError(message: string): APIError {
  return new APIError(402, message, "PLAN_LIMIT_EXCEEDED");
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

  async assertCanUploadToKinescope(input: {
    tenantId: string;
    incomingFileSize: number;
    incomingDurationSec?: number;
  }): Promise<void> {
    const workspace = await prisma.workspace.findUnique({
      where: { tenantId: input.tenantId },
      select: { id: true },
    });

    if (!workspace) {
      throw new APIError(404, "Workspace not found", "NOT_FOUND");
    }

    const subscription = await workspaceSubscriptionService.getWorkspaceSubscription(workspace.id);
    const limits = subscription.plan;
    if (limits.maxStorageGb === null && limits.maxTranscodingMinutes === null) {
      return;
    }

    if (limits.maxTranscodingMinutes !== null) {
      if (!Number.isInteger(input.incomingDurationSec) || (input.incomingDurationSec ?? 0) <= 0) {
        throw new APIError(
          400,
          "Video duration is required to enforce the monthly upload minutes limit.",
          "BAD_REQUEST",
        );
      }
    }

    const localUsage = await kinescopeBillingService.getLocalWorkspaceUsageEstimate({
      tenantId: input.tenantId,
      period: {
        from: subscription.currentPeriodStart,
        to: subscription.currentPeriodEnd,
      },
      hydrateMissingMetadata: true,
    });

    const projectedStorageGb = (localUsage.storageBytes + input.incomingFileSize) / DECIMAL_BYTES_PER_GB;
    const projectedTranscodingMinutes = (localUsage.periodTranscodingSeconds + (input.incomingDurationSec ?? 0)) / 60;

    if (limits.maxStorageGb !== null && projectedStorageGb > limits.maxStorageGb) {
      const currentStorageGb = localUsage.storageBytes / DECIMAL_BYTES_PER_GB;
      const message = `Storage limit would be exceeded for current plan (${currentStorageGb.toFixed(2)} GB + ${(input.incomingFileSize / DECIMAL_BYTES_PER_GB).toFixed(2)} GB > ${limits.maxStorageGb.toFixed(2)} GB). Uploads are blocked.`;
      await this.appendLimitEvent({
        workspaceId: workspace.id,
        workspaceSubscriptionId: subscription.subscriptionId,
        message,
      });
      throw createLimitError(message);
    }

    if (limits.maxTranscodingMinutes !== null && projectedTranscodingMinutes > limits.maxTranscodingMinutes) {
      const currentTranscodingMinutes = localUsage.periodTranscodingSeconds / 60;
      const message = `Monthly upload minutes limit would be exceeded for current plan (${currentTranscodingMinutes.toFixed(2)} min + ${((input.incomingDurationSec ?? 0) / 60).toFixed(2)} min > ${limits.maxTranscodingMinutes.toFixed(2)} min). Uploads are blocked.`;
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
