import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { assetService } from "@/lib/services/asset.service";
import { assertProjectAccess } from "@/lib/services/access-control.service";
import { z } from "zod";
import { handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({
  id: z.string().min(1),
});

export const GET = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = paramsSchema.parse(await context.params);
    await assertProjectAccess(req.user, id);
    const meta = await assetService.getVersionMeta(id, req.user.tenantId);
    return Response.json(meta, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
