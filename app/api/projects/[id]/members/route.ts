import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { assertOwnerOrPm, getWorkspaceForTenant } from "@/lib/services/access-control.service";
import { prisma } from "@/lib/utils/db";
import { handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({ id: z.string().min(1) });
const addMembersSchema = z.object({ userIds: z.array(z.string().min(1)).min(1) });

export const GET = withAuth(async (request: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    assertOwnerOrPm(request.user);
    const { id: projectId } = paramsSchema.parse(await context.params);

    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: request.user.tenantId },
      select: { id: true },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { addedAt: "desc" },
    });

    return Response.json(
      members.map((member) => ({
        userId: member.user.id,
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        email: member.user.email,
        addedAt: member.addedAt,
      })),
    );
  } catch (error) {
    return handleAPIError(error);
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    assertOwnerOrPm(request.user);
    const { id: projectId } = paramsSchema.parse(await context.params);
    const { userIds } = addMembersSchema.parse(await request.json());

    const workspace = await getWorkspaceForTenant(request.user.tenantId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: request.user.tenantId },
      select: { id: true },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    const editorMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: workspace.id,
        userId: { in: userIds },
        role: "EDITOR",
      },
      select: { userId: true },
    });

    const editorIds = new Set(editorMembers.map((item) => item.userId));
    const invalidUserId = userIds.find((id) => !editorIds.has(id));

    if (invalidUserId) {
      throw new Error("Only workspace editors can be added to project");
    }

    await prisma.projectMember.createMany({
      data: userIds.map((userId) => ({
        projectId,
        userId,
        roleOnProject: "editor",
        addedBy: request.user.userId,
      })),
      skipDuplicates: true,
    });

    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
});
