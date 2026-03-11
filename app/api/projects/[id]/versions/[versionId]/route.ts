import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { assetService } from "@/lib/services/asset.service";
import { assertOwnerOrPm, assertProjectAccess } from "@/lib/services/access-control.service";
import { handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({
  id: z.string().min(1),
  versionId: z.string().min(1),
});

export const DELETE = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string; versionId: string }> }) => {
  try {
    assertOwnerOrPm(req.user);
    const { id, versionId } = paramsSchema.parse(await context.params);

    await assertProjectAccess(req.user, id);
    await assetService.deleteVersion(
      { tenantId: req.user.tenantId, userId: req.user.userId, role: req.user.role },
      { projectId: id, versionId },
    );

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
