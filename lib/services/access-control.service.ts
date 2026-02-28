import type { JWTPayload } from "@/types";
import type { Prisma } from "@prisma/client";
import { APIError } from "@/lib/utils/api-error";
import { prisma } from "@/lib/utils/db";

export function isOwnerOrPm(role: string): boolean {
  return role === "OWNER" || role === "PM";
}

export function assertOwnerOrPm(user: JWTPayload): void {
  if (!isOwnerOrPm(user.role)) {
    throw new APIError(403, "Forbidden", "FORBIDDEN");
  }
}

export function buildAccessibleProjectsWhere(user: JWTPayload): Prisma.ProjectWhereInput {
  if (isOwnerOrPm(user.role)) {
    return { tenantId: user.tenantId };
  }

  return {
    tenantId: user.tenantId,
    members: {
      some: {
        userId: user.userId,
      },
    },
  };
}

export async function assertProjectAccess(user: JWTPayload, projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...buildAccessibleProjectsWhere(user),
    },
    select: { id: true },
  });

  if (!project) {
    throw new APIError(404, "Project not found", "NOT_FOUND");
  }
}

export async function getWorkspaceForTenant(tenantId: string) {
  return prisma.workspace.findUnique({
    where: { tenantId },
  });
}

export async function getWorkspaceEditors(workspaceId: string) {
  return prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      role: "EDITOR",
      user: { isActive: true },
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

export async function getAccessibleProjectIds(user: JWTPayload): Promise<string[]> {
  if (isOwnerOrPm(user.role)) {
    const all = await prisma.project.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true },
    });
    return all.map((project) => project.id);
  }

  const links = await prisma.projectMember.findMany({
    where: {
      userId: user.userId,
      project: {
        tenantId: user.tenantId,
      },
    },
    select: { projectId: true },
  });

  return links.map((item) => item.projectId);
}
