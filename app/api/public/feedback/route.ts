import { AuthorType, FeedbackCategory } from "@prisma/client";
import { z } from "zod";
import { FeedbackService } from "@/lib/services/feedback.service";
import { getTelegramNotificationService } from "@/lib/services/telegram-notification.service";
import { prisma } from "@/lib/utils/db";
import { handleAPIError } from "@/lib/utils/api-error";

const createPublicFeedbackSchema = z.object({
  assetVersionId: z.string().min(1),
  authorType: z.literal(AuthorType.CLIENT).default(AuthorType.CLIENT),
  authorEmail: z.string().email().optional(),
  authorName: z.string().max(200).optional(),
  timecodeSec: z.number().int().nonnegative().optional(),
  text: z.string().min(1).max(5000),
  category: z.nativeEnum(FeedbackCategory).optional(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = createPublicFeedbackSchema.parse(await request.json());
    const version = await prisma.assetVersion.findUnique({
      where: { id: payload.assetVersionId },
      include: {
        project: {
          select: {
            id: true,
            tenantId: true,
            name: true,
          },
        },
      },
    });

    if (!version) {
      return Response.json({ error: "Asset version not found" }, { status: 404 });
    }
    if (version.status === "APPROVED" || version.status === "FINAL") {
      return Response.json({ error: "Version is already approved. Feedback is locked." }, { status: 409 });
    }

    const feedbackService = new FeedbackService(prisma);
    const feedback = await feedbackService.createFeedback({
      ...payload,
      tenantId: version.project.tenantId,
    });

    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      await getTelegramNotificationService().notifyNewFeedback({
        projectName: version.project.name,
        versionNumber: version.versionNo,
        authorName: payload.authorName?.trim() || "Клиент",
        text: payload.text,
        timecodeSec: payload.timecodeSec,
        portalUrl: `${appUrl}/client-portal/${version.id}`,
      });
    } catch (telegramError) {
      console.error("[Telegram] feedback notification failed", telegramError);
    }

    return Response.json(feedback, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}

