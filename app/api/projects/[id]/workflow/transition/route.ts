import { z } from "zod";
import { WorkflowStageName } from "@prisma/client";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { workflowService } from "@/lib/services/workflow.service";
import { handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const transitionSchema = z.object({
  stageName: z.nativeEnum(WorkflowStageName),
  ownerUserId: z.string().min(1).optional(),
});

export const POST = withAuth(async (request: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const payload = transitionSchema.parse(await request.json());
    const stage = await workflowService.transitionToStage({
      projectId: id,
      tenantId: request.user.tenantId,
      stageName: payload.stageName,
      ownerUserId: payload.ownerUserId,
    });
    return Response.json(stage, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
