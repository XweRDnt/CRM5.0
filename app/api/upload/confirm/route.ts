import { z } from "zod";
import { withAuth } from "@/lib/middleware/auth";
import { getKinescopeService } from "@/lib/services/kinescope.service";
import { handleAPIError } from "@/lib/utils/api-error";

const confirmUploadSchema = z.object({
  projectId: z.string().min(1),
  kinescopeVideoId: z.string().min(1),
});

export const POST = withAuth(async (request) => {
  try {
    const payload = confirmUploadSchema.parse(await request.json());
    const kinescopeService = getKinescopeService();
    const result = await kinescopeService.confirmUpload(
      { tenantId: request.user.tenantId },
      {
        projectId: payload.projectId,
        kinescopeVideoId: payload.kinescopeVideoId,
      },
    );
    return Response.json(result, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
