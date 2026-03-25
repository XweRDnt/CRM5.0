import { z } from "zod";
import { prisma } from "@/lib/utils/db";
import { handleAPIError } from "@/lib/utils/api-error";
import { getWorkspaceDemoWorkspace, selectWorkspaceDemoActiveVersion } from "@/lib/utils/workspace-demo";
import { isWorkspaceDemoToken } from "@/lib/utils/workspace-demo-token";

const querySchema = z.object({
  versionId: z.string().min(1).optional(),
});

export async function GET(request: Request, context: { params: Promise<{ token: string; projectId: string }> }): Promise<Response> {
  try {
    const { token, projectId } = await context.params;

    if (!isWorkspaceDemoToken(token)) {
      return Response.json({ error: "Workspace demo not found" }, { status: 404 });
    }

    const workspace = await getWorkspaceDemoWorkspace();
    if (!workspace) {
      return Response.json({ error: "Workspace demo is not configured" }, { status: 404 });
    }

    const { versionId } = querySchema.parse({
      versionId: new URL(request.url).searchParams.get("versionId") ?? undefined,
    });

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId: workspace.tenantId,
      },
      include: {
        client: {
          select: {
            id: true,
            contactName: true,
            email: true,
          },
        },
        versions: {
          orderBy: { versionNo: "desc" },
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const activeVersion = selectWorkspaceDemoActiveVersion(project.versions, versionId);

    const feedback = activeVersion
      ? await prisma.feedbackItem.findMany({
          where: { assetVersionId: activeVersion.id },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            assetVersionId: true,
            authorType: true,
            authorName: true,
            authorEmail: true,
            text: true,
            status: true,
            timecodeSec: true,
            category: true,
            annotationData: true,
            createdAt: true,
            updatedAt: true,
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            threadMessages: {
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                text: true,
                createdAt: true,
              },
            },
          },
        })
      : [];

    return Response.json(
      {
        workspace,
        readonly: true,
        project: {
          id: project.id,
          name: project.name,
          status: project.status,
          portalToken: project.portalToken,
          client: {
            id: project.client.id,
            name: project.client.contactName,
            email: project.client.email,
          },
        },
        activeVersionId: activeVersion?.id ?? null,
        versions: project.versions.map((version) => ({
          id: version.id,
          projectId: version.projectId,
          versionNumber: version.versionNo,
          fileUrl: version.fileUrl,
          fileName: version.fileName,
          fileSize: version.fileSize,
          durationSec: version.durationSec,
          videoProvider: version.videoProvider,
          kinescopeVideoId: version.kinescopeVideoId,
          kinescopeAssetId: version.kinescopeAssetId,
          kinescopeProjectId: version.kinescopeProjectId,
          streamUrl: version.streamUrl,
          processingStatus: version.processingStatus,
          processingError: version.processingError,
          uploadedBy: {
            id: version.uploadedBy.id,
            name: `${version.uploadedBy.firstName} ${version.uploadedBy.lastName}`.trim(),
          },
          notes: version.notes,
          changeLog: version.changeLog,
          status: version.status,
          approvedBy: version.approvedBy,
          approvedAt: version.approvedAt,
          createdAt: version.createdAt,
        })),
        feedback: feedback.map((item) => ({
          id: item.id,
          assetVersionId: item.assetVersionId,
          authorType: item.authorType,
          author: {
            id: item.author?.id ?? undefined,
            name: item.authorName ?? (`${item.author?.firstName ?? ""} ${item.author?.lastName ?? ""}`.trim() || "Anonymous"),
            email: item.authorEmail ?? item.author?.email ?? undefined,
          },
          timecodeSec: item.timecodeSec,
          text: item.text,
          category: item.category,
          status: item.status,
          annotationData: item.annotationData,
          threadMessageCount: item.threadMessages.length,
          threadUnreadCount: 0,
          lastThreadMessageAt: item.threadMessages[0]?.createdAt ?? null,
          lastThreadMessagePreview: item.threadMessages[0]?.text ?? null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    return handleAPIError(error);
  }
}
