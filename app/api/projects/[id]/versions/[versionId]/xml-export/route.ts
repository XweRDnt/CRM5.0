import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { assertProjectAccess } from "@/lib/services/access-control.service";
import { FeedbackService } from "@/lib/services/feedback.service";
import { prisma } from "@/lib/utils/db";
import { handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({
  id: z.string().min(1),
  versionId: z.string().min(1),
});

export const POST = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string; versionId: string }> }) => {
  try {
    const { id, versionId } = paramsSchema.parse(await context.params);
    await assertProjectAccess(req.user, id);

    const feedbackService = new FeedbackService(prisma);
    await feedbackService.markVersionFeedbackInProgress({
      versionId,
      tenantId: req.user.tenantId,
    });

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
