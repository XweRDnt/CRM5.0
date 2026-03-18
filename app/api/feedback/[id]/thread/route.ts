import { z } from "zod";
import { AuthorType } from "@prisma/client";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { assertOwnerOrPm } from "@/lib/services/access-control.service";
import { FeedbackService } from "@/lib/services/feedback.service";
import { prisma } from "@/lib/utils/db";
import { APIError, handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const createThreadMessageSchema = z.object({
  text: z.string().trim().min(1).max(5000),
});

export const GET = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const feedback = await prisma.feedbackItem.findFirst({
      where: {
        id,
        assetVersion: {
          project: {
            tenantId: req.user.tenantId,
          },
        },
      },
      select: { id: true },
    });

    if (!feedback) {
      throw new APIError(404, "Feedback not found", "NOT_FOUND");
    }

    const items = await prisma.feedbackThreadMessage.findMany({
      where: { feedbackItemId: id },
      orderBy: { createdAt: "asc" },
    });

    return Response.json(
      items.map((item) => ({
        id: item.id,
        feedbackItemId: item.feedbackItemId,
        authorType: item.authorType,
        author: {
          id: item.authorUserId ?? undefined,
          name: item.authorName,
          role: item.authorRoleLabel,
        },
        text: item.text,
        createdAt: item.createdAt,
      })),
      { status: 200 },
    );
  } catch (error) {
    return handleAPIError(error);
  }
});

export const POST = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    assertOwnerOrPm(req.user);
    const { id } = paramsSchema.parse(await context.params);
    const payload = createThreadMessageSchema.parse(await req.json());
    const feedbackService = new FeedbackService(prisma);

    const message = await feedbackService.createThreadMessage({
      feedbackId: id,
      tenantId: req.user.tenantId,
      authorType: AuthorType.USER,
      authorUserId: req.user.userId,
      authorRole: req.user.role,
      text: payload.text,
    });

    return Response.json(message, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
});
