import { prisma } from "@/lib/utils/db";
import { handleAPIError } from "@/lib/utils/api-error";
import { VERSION_STATUS_LABELS, toVersionUiStatus } from "@/lib/constants/status-ui";
import { getWorkspaceDemoWorkspace } from "@/lib/utils/workspace-demo";
import { isWorkspaceDemoToken } from "@/lib/utils/workspace-demo-token";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }): Promise<Response> {
  try {
    const { token } = await context.params;

    if (!isWorkspaceDemoToken(token)) {
      return Response.json({ error: "Workspace demo not found" }, { status: 404 });
    }

    const workspace = await getWorkspaceDemoWorkspace();
    if (!workspace) {
      return Response.json({ error: "Workspace demo is not configured" }, { status: 404 });
    }

    const projects = await prisma.project.findMany({
      where: {
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
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(
      {
        workspace,
        readonly: true,
        projects: projects.map((project) => {
          const latestVersion = project.versions[0] ?? null;
          const uiStatus = latestVersion ? toVersionUiStatus(latestVersion.status) : toVersionUiStatus("DRAFT");
          return {
            id: project.id,
            name: project.name,
            client: {
              id: project.client.id,
              name: project.client.contactName,
              email: project.client.email,
            },
            status: project.status,
            createdAt: project.createdAt,
            latestVersionId: latestVersion?.id ?? null,
            latestVersionNumber: latestVersion?.versionNo ?? null,
            latestVersionStatus: latestVersion?.status ?? null,
            latestVersionStatusLabel: VERSION_STATUS_LABELS[uiStatus],
          };
        }),
      },
      { status: 200 },
    );
  } catch (error) {
    return handleAPIError(error);
  }
}
