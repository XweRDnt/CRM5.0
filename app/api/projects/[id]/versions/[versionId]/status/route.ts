import { VersionStatus } from "@prisma/client";
import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { assetService } from "@/lib/services/asset.service";
import { handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({
  id: z.string().min(1),
  versionId: z.string().min(1),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(VersionStatus),
});

export const PATCH = withAuth(
  async (request: AuthenticatedRequest, context: { params: Promise<{ id: string; versionId: string }> }) => {
    try {
      const { id, versionId } = paramsSchema.parse(await context.params);
      const payload = updateStatusSchema.parse(await request.json());

      const updated = await assetService.updateVersionStatus({
        projectId: id,
        versionId,
        tenantId: request.user.tenantId,
        status: payload.status,
      });

      return Response.json(updated, { status: 200 });
    } catch (error) {
      return handleAPIError(error);
    }
  },
);
