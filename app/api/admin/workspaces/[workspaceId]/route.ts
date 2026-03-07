import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { prisma } from "@/lib/utils/db";
import { APIError, handleAPIError } from "@/lib/utils/api-error";
import { assertAdminRequest } from "@/app/api/admin/_helpers";
import { workspaceSubscriptionService } from "@/lib/services/workspace-subscription.service";
import { summarizeKinescopeUsageRawJson } from "@/lib/services/kinescope-billing.service";

const paramsSchema = z.object({
  workspaceId: z.string().min(1),
});

export const GET = withAuth(async (request: AuthenticatedRequest, context: { params: Promise<{ workspaceId: string }> }) => {
  try {
    await assertAdminRequest(request);
    const { workspaceId } = paramsSchema.parse(await context.params);

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        createdAt: true,
        isBlocked: true,
        billingTrackingStartedAt: true,
        kinescopeProjectId: true,
        kinescopeProjectName: true,
        kinescopeProjectProvisionedAt: true,
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        members: {
          select: { id: true },
        },
        usageSnapshots: {
          orderBy: { fetchedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!workspace) {
      throw new APIError(404, "Workspace not found", "NOT_FOUND");
    }

    const subscription = await workspaceSubscriptionService.ensureWorkspaceSubscription(workspace.id);
    const events = await workspaceSubscriptionService.listWorkspaceSubscriptionEvents(workspace.id, 100);
    const projectCount = await prisma.project.count({ where: { tenantId: workspace.tenantId } });
    const usage = workspace.usageSnapshots[0] ?? null;

    return Response.json(
      {
        workspace: {
          workspaceId: workspace.id,
          tenantId: workspace.tenantId,
          workspaceName: workspace.name,
          registeredAt: workspace.createdAt,
          isBlocked: workspace.isBlocked,
          owner: {
            userId: workspace.owner.id,
            email: workspace.owner.email,
            fullName: `${workspace.owner.firstName} ${workspace.owner.lastName}`.trim(),
          },
          memberCount: workspace.members.length,
          projectCount,
          kinescopeProjectId: workspace.kinescopeProjectId,
          kinescopeProjectName: workspace.kinescopeProjectName,
          kinescopeProjectProvisionedAt: workspace.kinescopeProjectProvisionedAt,
          billingTrackingStartedAt: workspace.billingTrackingStartedAt,
          isLegacy: workspace.billingTrackingStartedAt === null,
        },
        subscription,
        usage: usage
          ? {
              trafficGb: usage.trafficGb ? Number(usage.trafficGb.toString()) : 0,
              storageGb: usage.storageGb ? Number(usage.storageGb.toString()) : 0,
              transcodingMinutes: usage.transcodingMinutes ? Number(usage.transcodingMinutes.toString()) : 0,
              amountMinor: usage.amountMinor ?? 0,
              periodStart: usage.periodStart,
              periodEnd: usage.periodEnd,
              fetchedAt: usage.fetchedAt,
              expiresAt: usage.expiresAt,
              reason:
                usage.rawJson && typeof usage.rawJson === "object" && !Array.isArray(usage.rawJson)
                  ? (((usage.rawJson as Record<string, unknown>).reason as string | undefined) ?? null)
                  : null,
              debug: summarizeKinescopeUsageRawJson(usage.rawJson),
            }
          : null,
        events,
      },
      { status: 200 },
    );
  } catch (error) {
    return handleAPIError(error);
  }
});
