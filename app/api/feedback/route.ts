import { z } from "zod";
import { AuthorType, FeedbackCategory } from "@prisma/client";
import { withAuth } from "@/lib/middleware/auth";
import { assertProjectAccess } from "@/lib/services/access-control.service";
import { FeedbackService } from "@/lib/services/feedback.service";
import { prisma } from "@/lib/utils/db";
import { handleAPIError } from "@/lib/utils/api-error";

const createFeedbackSchema = z.object({
  assetVersionId: z.string().min(1),
  authorType: z.nativeEnum(AuthorType),
  authorId: z.string().min(1).optional(),
  authorEmail: z.string().email().optional(),
  authorName: z.string().max(200).optional(),
  timecodeSec: z.number().int().nonnegative().optional(),
  text: z.string().min(1).max(5000),
  category: z.nativeEnum(FeedbackCategory).optional(),
});

export const POST = withAuth(async (req) => {
  try {
    const validated = createFeedbackSchema.parse(await req.json());
    const version = await prisma.assetVersion.findUnique({
      where: { id: validated.assetVersionId },
      select: { projectId: true },
    });
    if (!version) {
      throw new Error("Version not found");
    }
    await assertProjectAccess(req.user, version.projectId);
    const feedbackService = new FeedbackService(prisma);
    const feedback = await feedbackService.createFeedback({
      ...validated,
      tenantId: req.user.tenantId,
      authorId: validated.authorType === AuthorType.USER ? req.user.userId : validated.authorId,
    });

    return Response.json(feedback, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
});

