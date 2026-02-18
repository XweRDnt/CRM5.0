import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { FeedbackService } from "@/lib/services/feedback.service";
import { prisma } from "@/lib/utils/db";
import { handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({
  id: z.string().min(1),
});

export const GET = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const feedbackService = new FeedbackService(prisma);
    const feedback = await feedbackService.listFeedbackByProject(id, req.user.tenantId);
    return Response.json(feedback, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
