import { VersionStatus, type AssetVersion } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/utils/db";
import { handleAPIError } from "@/lib/utils/api-error";
import { resolvePortalProjectToken } from "@/lib/utils/portal-token";

const paramsSchema = z.object({
  token: z.string().min(1),
});

const querySchema = z.object({
  versionId: z.string().min(1).optional(),
});

function selectActiveVersion(versions: AssetVersion[], requestedVersionId?: string): AssetVersion | null {
  if (versions.length === 0) {
    return null;
  }

  if (requestedVersionId) {
    const requested = versions.find((item) => item.id === requestedVersionId);
    if (requested) {
      return requested;
    }
  }

  const inReview = versions.find((item) => item.status === VersionStatus.IN_REVIEW);
  return inReview ?? versions[0];
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }): Promise<Response> {
  try {
    const { token } = paramsSchema.parse(await context.params);
    const searchParams = new URL(request.url).searchParams;
    const { versionId: requestedVersionId } = querySchema.parse({
      versionId: searchParams.get("versionId") ?? undefined,
    });

    const portalToken = resolvePortalProjectToken(token);

    if (!portalToken) {
      return Response.json({ error: "Invalid portal token" }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: { portalToken },
      include: {
        client: {
          select: {
            contactName: true,
            companyName: true,
          },
        },
        versions: {
          orderBy: { versionNo: "desc" },
        },
      },
    });

    if (!project) {
      return Response.json({ error: "Portal not found" }, { status: 404 });
    }

    let activeVersion = selectActiveVersion(project.versions, requestedVersionId);

    if (activeVersion && activeVersion.status === VersionStatus.DRAFT) {
      const updated = await prisma.assetVersion.update({
        where: { id: activeVersion.id },
        data: { status: VersionStatus.IN_REVIEW },
      });

      project.versions = project.versions.map((version) => (version.id === updated.id ? updated : version));
      activeVersion = updated;
    }

    const feedbackItems = activeVersion
      ? await prisma.feedbackItem.findMany({
          where: { assetVersionId: activeVersion.id },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            text: true,
            timecodeSec: true,
            createdAt: true,
            authorName: true,
            authorEmail: true,
            author: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        })
      : [];

    return Response.json(
      {
        project: {
          id: project.id,
          name: project.name,
          clientName: project.client.contactName,
          companyName: project.client.companyName,
        },
        activeVersionId: activeVersion?.id ?? null,
        versions: project.versions.map((version) => ({
          id: version.id,
          versionNumber: version.versionNo,
          fileUrl: version.fileUrl,
          fileName: version.fileName,
          videoProvider: version.videoProvider,
          kinescopeVideoId: version.kinescopeVideoId,
          streamUrl: version.streamUrl,
          processingStatus: version.processingStatus,
          durationSec: version.durationSec,
          status: version.status,
          createdAt: version.createdAt,
        })),
        feedback: feedbackItems.map((item) => ({
          id: item.id,
          text: item.text,
          timecodeSec: item.timecodeSec,
          createdAt: item.createdAt,
          authorName:
            item.authorName ??
            (item.author ? `${item.author.firstName} ${item.author.lastName}`.trim() : null) ??
            "Anonymous",
          authorEmail: item.authorEmail ?? null,
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    return handleAPIError(error);
  }
}
