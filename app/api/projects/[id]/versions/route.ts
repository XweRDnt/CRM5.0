import { VideoProcessingStatus } from "@prisma/client";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { assetService, VersionConflictError } from "@/lib/services/asset.service";
import { assertProjectAccess } from "@/lib/services/access-control.service";
import { FeedbackService } from "@/lib/services/feedback.service";
import { prisma } from "@/lib/utils/db";
import { z } from "zod";
import { handleAPIError } from "@/lib/utils/api-error";
import { withServerTiming } from "@/lib/utils/server-timing";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const createVersionSchema = z.object({
  versionNo: z.number().int().min(1).optional(),
  title: z.string().min(1).max(255).optional(),
  fileUrl: z.string().url().optional(),
  fileKey: z.string().min(1).optional(),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  durationSec: z.number().int().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
  kinescopeVideoId: z.string().min(1).optional(),
  kinescopeAssetId: z.string().min(1).optional(),
  kinescopeProjectId: z.string().min(1).optional(),
  streamUrl: z.string().url().optional(),
  processingStatus: z.nativeEnum(VideoProcessingStatus).optional(),
  processingError: z.string().max(2000).optional(),
});

export const GET = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) =>
  withServerTiming("api-project-versions", async () => {
    try {
      const { id } = paramsSchema.parse(await context.params);
      await assertProjectAccess(req.user, id);
      const versions = await assetService.listVersionsByProject(id, req.user.tenantId);
      return Response.json(versions, { status: 200 });
    } catch (error) {
      return handleAPIError(error);
    }
  }),
);

export const POST = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = paramsSchema.parse(await context.params);
    await assertProjectAccess(req.user, id);
    const payload = createVersionSchema.parse(await req.json());
    const previousVersion = await prisma.assetVersion.findFirst({
      where: {
        projectId: id,
      },
      orderBy: {
        versionNo: "desc",
      },
      select: {
        id: true,
      },
    });

    const version = await assetService.createVersion({
      projectId: id,
      tenantId: req.user.tenantId,
      versionNo: payload.versionNo,
      title: payload.title,
      fileUrl: payload.fileUrl,
      fileKey: payload.fileKey,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      durationSec: payload.durationSec,
      uploadedByUserId: req.user.userId,
      notes: payload.notes,
      kinescopeVideoId: payload.kinescopeVideoId,
      kinescopeAssetId: payload.kinescopeAssetId,
      kinescopeProjectId: payload.kinescopeProjectId,
      streamUrl: payload.streamUrl,
      processingStatus: payload.processingStatus,
      processingError: payload.processingError,
    });

    if (previousVersion && previousVersion.id !== version.id) {
      const feedbackService = new FeedbackService(prisma);
      await feedbackService.resolvePreviousVersionFeedback({
        previousVersionId: previousVersion.id,
        tenantId: req.user.tenantId,
      });
    }

    return Response.json(version, { status: 201 });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return Response.json(
        {
          error: error.message,
          suggestedVersionNo: error.suggestedVersionNo,
        },
        { status: 409 },
      );
    }
    return handleAPIError(error);
  }
});
