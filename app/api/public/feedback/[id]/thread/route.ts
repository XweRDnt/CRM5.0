import { z } from "zod";
import { AuthorType } from "@prisma/client";
import { FeedbackService } from "@/lib/services/feedback.service";
import { prisma } from "@/lib/utils/db";
import { APIError, handleAPIError } from "@/lib/utils/api-error";
import { isDemoToken } from "@/lib/utils/demo-token";
import { resolvePortalProjectToken } from "@/lib/utils/portal-token";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const createPortalThreadMessageSchema = z.object({
  token: z.string().min(1),
  authorName: z.string().trim().min(1).max(200).optional(),
  text: z.string().trim().min(1).max(5000),
});

async function assertPortalFeedbackAccess(feedbackId: string, token: string): Promise<{ portalToken: string }> {
  const portalToken = resolvePortalProjectToken(token);

  if (!portalToken) {
    throw new APIError(400, "Invalid portal token", "VALIDATION_ERROR");
  }

  const feedback = await prisma.feedbackItem.findFirst({
    where: {
      id: feedbackId,
      assetVersion: {
        project: {
          portalToken,
        },
      },
    },
    select: { id: true },
  });

  if (!feedback) {
    throw new APIError(404, "Feedback not found", "NOT_FOUND");
  }

  return { portalToken };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const token = new URL(request.url).searchParams.get("token") ?? "";
    await assertPortalFeedbackAccess(id, token);

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
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const payload = createPortalThreadMessageSchema.parse(await request.json());
    const { portalToken } = await assertPortalFeedbackAccess(id, payload.token);

    if (isDemoToken(portalToken)) {
      return Response.json({ code: "DEMO_READONLY", error: "Demo mode is read-only" }, { status: 403 });
    }

    const feedbackService = new FeedbackService(prisma);

    const message = await feedbackService.createThreadMessage({
      feedbackId: id,
      tenantId: (await prisma.project.findFirstOrThrow({
        where: { portalToken },
        select: { tenantId: true },
      })).tenantId,
      authorType: AuthorType.CLIENT,
      authorName: payload.authorName ?? "Client",
      authorRole: "CLIENT",
      clientIdentity: `portal:${portalToken}`,
      text: payload.text,
    });

    return Response.json(message, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}
