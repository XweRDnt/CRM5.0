import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { assertOwnerOrPm, getWorkspaceForTenant } from "@/lib/services/access-control.service";
import { prisma } from "@/lib/utils/db";
import { handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({ id: z.string().min(1) });
const addMembersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
  roleOnProject: z.enum(["editor", "pm"]).default("editor"),
});

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
        roleOnProject: member.roleOnProject,
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
    const { userIds, roleOnProject } = addMembersSchema.parse(await request.json());

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

    await prisma.$transaction(
      userIds.map((userId) =>
        prisma.projectMember.upsert({
          where: {
            projectId_userId: {
              projectId,
              userId,
            },
          },
          update: {
            roleOnProject,
            addedBy: request.user.userId,
          },
          create: {
            projectId,
            userId,
            roleOnProject,
            addedBy: request.user.userId,
          },
        }),
      ),
    );

    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
});
