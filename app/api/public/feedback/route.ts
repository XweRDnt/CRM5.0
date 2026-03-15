import { AuthorType, FeedbackCategory, FeedbackStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { getTelegramNotificationService } from "@/lib/services/telegram-notification.service";
import { prisma } from "@/lib/utils/db";
import { handleAPIError } from "@/lib/utils/api-error";
import { validateAnnotationData } from "@/lib/annotations/validation";

const createPublicFeedbackSchema = z
  .object({
    assetVersionId: z.string().min(1),
    authorType: z.literal(AuthorType.CLIENT).default(AuthorType.CLIENT),
    authorEmail: z.string().email().optional(),
    authorName: z.string().max(200).optional(),
    timecodeSec: z.number().int().nonnegative().optional(),
    text: z.string().max(5000).optional(),
    category: z.nativeEnum(FeedbackCategory).optional(),
    annotationData: z.unknown().optional(),
    annotationPreview: z.string().url().optional(),
  })
  .superRefine((value, ctx) => {
    const text = value.text?.trim() ?? "";
    const hasText = text.length > 0;
    const hasAnnotation = value.annotationData !== undefined;
    if (!hasText && !hasAnnotation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["text"],
        message: "text is required when annotation data is not provided",
      });
    }
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
            portalToken: true,
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

    if (payload.annotationData !== undefined) {
      const validation = validateAnnotationData(payload.annotationData);
      if (!validation.ok) {
        return Response.json({ error: validation.error }, { status: 400 });
      }
    }

    const normalizedText = payload.text?.trim() ?? "";

    const feedback = await prisma.feedbackItem.create({
      data: {
        assetVersionId: payload.assetVersionId,
        authorType: AuthorType.CLIENT,
        authorEmail: payload.authorEmail ?? null,
        authorName: payload.authorName ?? null,
        timecodeSec: payload.timecodeSec ?? null,
        text: normalizedText,
        category: payload.category ?? null,
        annotationData: payload.annotationData ?? Prisma.DbNull,
        annotationPreview: payload.annotationPreview ?? null,
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
        annotationData: true,
        annotationPreview: true,
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
        text: normalizedText,
        timecodeSec: payload.timecodeSec,
        portalUrl: `${appUrl}/client-portal/${version.project.portalToken}`,
      })
      .catch((telegramError) => {
        console.error("[Telegram] feedback notification failed", telegramError);
      });

    return response;
  } catch (error) {
    return handleAPIError(error);
  }
}
