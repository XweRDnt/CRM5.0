import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { prisma } from "@/lib/utils/db";
import { APIError, handleAPIError } from "@/lib/utils/api-error";

const toggleWorkspaceSchema = z.object({
  workspaceId: z.string().min(1),
});

async function assertAdmin(request: AuthenticatedRequest): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) {
    throw new APIError(403, "Forbidden", "FORBIDDEN");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: request.user.userId },
    select: { email: true },
  });

  if (!currentUser || currentUser.email.trim().toLowerCase() !== adminEmail) {
    throw new APIError(403, "Forbidden", "FORBIDDEN");
  }
}

export const GET = withAuth(async (request) => {
  try {
    await assertAdmin(request);

    const workspaces = await prisma.workspace.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        isBlocked: true,
        owner: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return Response.json(
      workspaces.map((workspace) => ({
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        ownerEmail: workspace.owner.email,
        registeredAt: workspace.createdAt,
        isBlocked: workspace.isBlocked,
      })),
      { status: 200 },
    );
  } catch (error) {
    return handleAPIError(error);
  }
});

export const PATCH = withAuth(async (request) => {
  try {
    await assertAdmin(request);

    const { workspaceId } = toggleWorkspaceSchema.parse(await request.json());
    const current = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, isBlocked: true },
    });

    if (!current) {
      throw new APIError(404, "Workspace not found", "NOT_FOUND");
    }

    const updated = await prisma.workspace.update({
      where: { id: current.id },
      data: { isBlocked: !current.isBlocked },
      select: { id: true, isBlocked: true },
    });

    return Response.json(
      {
        workspaceId: updated.id,
        isBlocked: updated.isBlocked,
      },
      { status: 200 },
    );
  } catch (error) {
    return handleAPIError(error);
  }
});
