import { z } from "zod";
import { withAuth } from "@/lib/middleware/auth";
import { getStorageService } from "@/lib/services/storage.service";
import { handleAPIError } from "@/lib/utils/api-error";

const confirmUploadSchema = z.object({
  fileKey: z.string().min(1),
});

export const POST = withAuth(async (request) => {
  try {
    const payload = confirmUploadSchema.parse(await request.json());
    const storageService = getStorageService();
    await storageService.confirmUpload(payload.fileKey, request.user.tenantId);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
