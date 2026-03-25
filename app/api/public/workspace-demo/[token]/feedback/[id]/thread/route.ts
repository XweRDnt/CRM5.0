import { prisma } from "@/lib/utils/db";
import { handleAPIError } from "@/lib/utils/api-error";
import { getWorkspaceDemoWorkspace } from "@/lib/utils/workspace-demo";
import { isWorkspaceDemoToken } from "@/lib/utils/workspace-demo-token";

export async function GET(_request: Request, context: { params: Promise<{ token: string; id: string }> }): Promise<Response> {
  try {
    const { token, id } = await context.params;

    if (!isWorkspaceDemoToken(token)) {
      return Response.json({ error: "Workspace demo not found" }, { status: 404 });
    }

    const workspace = await getWorkspaceDemoWorkspace();
    if (!workspace) {
      return Response.json({ error: "Workspace demo is not configured" }, { status: 404 });
    }

    const feedback = await prisma.feedbackItem.findFirst({
      where: {
        id,
        assetVersion: {
          project: {
            tenantId: workspace.tenantId,
          },
        },
      },
      select: { id: true },
    });

    if (!feedback) {
      return Response.json({ error: "Feedback not found" }, { status: 404 });
    }

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
