import { WorkspaceSubscriptionEventType } from "@prisma/client";
import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { prisma } from "@/lib/utils/db";
import { APIError, handleAPIError } from "@/lib/utils/api-error";
import { assertAdminRequest } from "@/app/api/admin/_helpers";
import { workspaceSubscriptionService } from "@/lib/services/workspace-subscription.service";

const paramsSchema = z.object({
  workspaceId: z.string().min(1),
});

const patchSchema = z.object({
  isBlocked: z.boolean().optional(),
  comment: z.string().max(1000).optional(),
});

export const PATCH = withAuth(async (request: AuthenticatedRequest, context: { params: Promise<{ workspaceId: string }> }) => {
  try {
    const admin = await assertAdminRequest(request);
    const { workspaceId } = paramsSchema.parse(await context.params);
    const payload = patchSchema.parse(await request.json().catch(() => ({})));

    const current = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, isBlocked: true },
    });

    if (!current) {
      throw new APIError(404, "Workspace not found", "NOT_FOUND");
    }

    const targetValue = payload.isBlocked ?? !current.isBlocked;

    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { isBlocked: targetValue },
      select: { id: true, isBlocked: true },
    });

    await workspaceSubscriptionService.appendWorkspaceStatusEvent({
      workspaceId,
      actorUserId: admin.id,
      type: targetValue ? WorkspaceSubscriptionEventType.WORKSPACE_BLOCKED : WorkspaceSubscriptionEventType.WORKSPACE_UNBLOCKED,
      comment: payload.comment,
    });

    return Response.json(
      {
        workspaceId: updated.id,
        isBlocked: updated.isBlocked,
      },
      { status: 200 },
    );
  } catch (error) {
    return handleAPIError(error);
  }
});
