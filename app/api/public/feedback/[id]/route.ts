import { z } from "zod";

import { FeedbackService } from "@/lib/services/feedback.service";
import { prisma } from "@/lib/utils/db";
import { APIError, handleAPIError } from "@/lib/utils/api-error";
import { isDemoToken } from "@/lib/utils/demo-token";
import { resolvePortalProjectToken } from "@/lib/utils/portal-token";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const deleteSchema = z.object({
  token: z.string().min(1),
});

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const payload = deleteSchema.parse(await request.json());
    const portalToken = resolvePortalProjectToken(payload.token);

    if (!portalToken) {
      throw new APIError(400, "Invalid portal token", "VALIDATION_ERROR");
    }

    const feedback = await prisma.feedbackItem.findFirst({
      where: {
        id,
        assetVersion: {
          project: {
            portalToken,
          },
        },
      },
      select: {
        assetVersion: {
          select: {
            project: {
              select: {
                tenantId: true,
                portalToken: true,
              },
            },
          },
        },
      },
    });

    if (!feedback) {
      throw new APIError(404, "Feedback not found", "NOT_FOUND");
    }

    if (isDemoToken(feedback.assetVersion.project.portalToken)) {
      return Response.json({ code: "DEMO_READONLY", error: "Demo mode is read-only" }, { status: 403 });
    }

    const feedbackService = new FeedbackService(prisma);
    await feedbackService.deleteFeedback(id, feedback.assetVersion.project.tenantId);

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
}
