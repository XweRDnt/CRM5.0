import { withAuth } from "@/lib/middleware/auth";
import { getKinescopeService } from "@/lib/services/kinescope.service";
import { z } from "zod";
import { handleAPIError } from "@/lib/utils/api-error";

const getUploadUrlSchema = z.object({
  projectId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1),
  fileSize: z.number().int().positive(),
});

export const POST = withAuth(async (req) => {
  try {
    const payload = getUploadUrlSchema.parse(await req.json());
    const kinescopeService = getKinescopeService();
    const upload = await kinescopeService.createUploadSession({ tenantId: req.user.tenantId }, payload);
    return Response.json(upload, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
