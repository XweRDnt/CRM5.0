import { z } from "zod";
import { FeedbackCategory } from "@prisma/client";
import { withAuth } from "@/lib/middleware/auth";
import { aiService } from "@/lib/services/ai.service";
import { handleAPIError } from "@/lib/utils/api-error";

const parseFeedbackSchema = z.object({
  feedbackItems: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string().min(1),
        timecodeSec: z.number().int().nonnegative().optional(),
        category: z.nativeEnum(FeedbackCategory).optional(),
        authorName: z.string().min(1),
      }),
    )
    .min(1),
  projectContext: z
    .object({
      name: z.string().min(1),
      brief: z.string().optional(),
    })
    .optional(),
});

export const POST = withAuth(async (request) => {
  try {
    const payload = parseFeedbackSchema.parse(await request.json());
    const parsed = await aiService.parseFeedback(payload);
    return Response.json(parsed, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
