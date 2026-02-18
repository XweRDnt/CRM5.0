import { z } from "zod";
import { FeedbackCategory } from "@prisma/client";
import { withAuth } from "@/lib/middleware/auth";
import { aiService } from "@/lib/services/ai.service";
import { handleAPIError } from "@/lib/utils/api-error";

const generateSummarySchema = z.object({
  projectName: z.string().min(1),
  completedTasks: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        category: z.nativeEnum(FeedbackCategory),
      }),
    )
    .min(1),
  nextSteps: z.string().optional(),
});

export const POST = withAuth(async (request) => {
  try {
    const payload = generateSummarySchema.parse(await request.json());
    const summary = await aiService.generateClientUpdate(payload);
    return Response.json(summary, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
