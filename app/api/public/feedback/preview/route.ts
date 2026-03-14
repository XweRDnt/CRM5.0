import { z } from "zod";
import { handleAPIError } from "@/lib/utils/api-error";
import { createAnnotationPreview } from "@/lib/services/annotation-preview.service";

const previewSchema = z.object({
  assetVersionId: z.string().min(1),
  pngBase64: z.string().min(1),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = previewSchema.parse(await request.json());
    const result = await createAnnotationPreview(payload);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}
