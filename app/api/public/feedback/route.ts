import { AuthorType, FeedbackCategory, FeedbackStatus } from "@prisma/client";
import { z } from "zod";
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

    if (!payload.authorEmail && !payload.authorName) {
      return Response.json({ error: "authorEmail or authorName is required for CLIENT type feedback" }, { status: 400 });
    }

    const feedback = await prisma.feedbackItem.create({
      data: {
        assetVersionId: payload.assetVersionId,
        authorType: AuthorType.CLIENT,
        authorEmail: payload.authorEmail ?? null,
        authorName: payload.authorName ?? null,
        timecodeSec: payload.timecodeSec ?? null,
        text: payload.text,
        category: payload.category ?? null,
        status: FeedbackStatus.NEW,
      },
      select: {
        id: true,
        assetVersionId: true,
        authorType: true,
        authorEmail: true,
        authorName: true,
        timecodeSec: true,
        text: true,
        category: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const response = Response.json(feedback, { status: 201 });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    void getTelegramNotificationService()
      .notifyNewFeedback({
        projectName: version.project.name,
        versionNumber: version.versionNo,
        authorName: payload.authorName?.trim() || "Client",
        text: payload.text,
        timecodeSec: payload.timecodeSec,
        portalUrl: `${appUrl}/client-portal/${version.id}`,
      })
      .catch((telegramError) => {
        console.error("[Telegram] feedback notification failed", telegramError);
      });

    return response;
  } catch (error) {
    return handleAPIError(error);
  }
}
