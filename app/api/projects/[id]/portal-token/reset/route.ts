import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { projectService } from "@/lib/services/project.service";
import { assertOwnerOrPm } from "@/lib/services/access-control.service";
import { handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({
  id: z.string().min(1),
});

export const POST = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    assertOwnerOrPm(req.user);
    const { id } = paramsSchema.parse(await context.params);
    const result = await projectService.rotatePortalToken(id, req.user.tenantId, req.user);
    return Response.json(result, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
