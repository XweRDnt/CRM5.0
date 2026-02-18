import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { workflowService } from "@/lib/services/workflow.service";
import { handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({
  id: z.string().min(1),
});

export const GET = withAuth(async (request: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const metrics = await workflowService.getProjectMetrics(id, request.user.tenantId);
    return Response.json(metrics, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
