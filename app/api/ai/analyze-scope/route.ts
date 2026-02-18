import { z } from "zod";
import { withAuth } from "@/lib/middleware/auth";
import { aiService } from "@/lib/services/ai.service";
import { handleAPIError } from "@/lib/utils/api-error";

const analyzeScopeSchema = z.object({
  feedbackText: z.string().min(1),
  feedbackId: z.string().min(1),
  projectScope: z.string().min(1),
  projectName: z.string().min(1),
});

export const POST = withAuth(async (request) => {
  try {
    const payload = analyzeScopeSchema.parse(await request.json());
    const analysis = await aiService.analyzeScopeCompliance(payload);
    return Response.json(analysis, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
