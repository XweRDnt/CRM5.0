import type { JWTPayload, User, UserRole } from "@/types";
import { prisma } from "@/lib/utils/db";
import { isWorkspaceDemoToken } from "@/lib/utils/workspace-demo-token";
import { getWorkspaceDemoWorkspaceId } from "@/lib/utils/workspace-demo";

type WorkspaceDemoSession = {
  payload: JWTPayload;
  user: User;
};

export async function resolveWorkspaceDemoSession(token: string): Promise<WorkspaceDemoSession | null> {
  if (!isWorkspaceDemoToken(token)) {
    return null;
  }

  const workspaceId = getWorkspaceDemoWorkspaceId();
  if (!workspaceId) {
    return null;
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      owner: true,
      tenant: true,
    },
  });

  if (!workspace) {
    return null;
  }

  const role = "OWNER" as UserRole;

  return {
    payload: {
      userId: workspace.owner.id,
      tenantId: workspace.tenantId,
      role,
      isDemo: true,
    },
    user: {
      id: workspace.owner.id,
      tenantId: workspace.owner.tenantId,
      role,
      firstName: workspace.owner.firstName,
      lastName: workspace.owner.lastName,
      email: workspace.owner.email,
      passwordHash: workspace.owner.passwordHash,
      isActive: workspace.owner.isActive,
      createdAt: workspace.owner.createdAt,
      updatedAt: workspace.owner.updatedAt,
      tenant: {
        id: workspace.tenant.id,
        name: workspace.tenant.name,
        slug: workspace.tenant.slug,
      },
    },
  };
}
