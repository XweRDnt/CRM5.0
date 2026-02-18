import { z } from "zod";
import { FeedbackStatus } from "@prisma/client";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { FeedbackService } from "@/lib/services/feedback.service";
import { prisma } from "@/lib/utils/db";
import { APIError, handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const updateFeedbackSchema = z.object({
  status: z.nativeEnum(FeedbackStatus),
});

export const PATCH = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const payload = updateFeedbackSchema.parse(await req.json());
    const feedbackService = new FeedbackService(prisma);
    const feedback = await feedbackService.updateFeedbackStatus({
      feedbackId: id,
      tenantId: req.user.tenantId,
      status: payload.status,
    });
    return Response.json(feedback, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});

export const DELETE = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const feedbackService = new FeedbackService(prisma);
    await feedbackService.deleteFeedback(id, req.user.tenantId);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
      return handleAPIError(new APIError(404, error.message, "NOT_FOUND"));
    }
    return handleAPIError(error);
  }
});

