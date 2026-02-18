import { z } from "zod";
import { VersionStatus } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { handleAPIError } from "@/lib/utils/api-error";
import { resolvePortalVersionId } from "@/lib/utils/portal-token";

const paramsSchema = z.object({
  token: z.string().min(1),
});

export async function GET(_: Request, context: { params: Promise<{ token: string }> }): Promise<Response> {
  try {
    const { token } = paramsSchema.parse(await context.params);
    const versionId = resolvePortalVersionId(token);

    if (!versionId) {
      return Response.json({ error: "Invalid or expired portal token" }, { status: 400 });
    }

    const version = await prisma.assetVersion.findFirst({
      where: { id: versionId },
      include: {
        project: {
          include: {
            client: {
              select: {
                contactName: true,
                companyName: true,
              },
            },
          },
        },
        feedbackItems: {
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
        },
      },
    });

    if (!version) {
      return Response.json({ error: "Version not found" }, { status: 404 });
    }

    if (version.status === VersionStatus.DRAFT) {
      const updated = await prisma.assetVersion.update({
        where: { id: version.id },
        data: { status: VersionStatus.IN_REVIEW },
      });
      version.status = updated.status;
    }

    return Response.json(
      {
        project: {
          id: version.project.id,
          name: version.project.name,
          clientName: version.project.client.contactName,
          companyName: version.project.client.companyName,
        },
        version: {
          id: version.id,
          versionNumber: version.versionNo,
          fileUrl: version.fileUrl,
          fileName: version.fileName,
          durationSec: version.durationSec,
          status: version.status,
          createdAt: version.createdAt,
        },
        feedback: version.feedbackItems.map((item) => ({
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
