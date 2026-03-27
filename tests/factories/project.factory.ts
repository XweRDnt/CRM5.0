import { ProjectStatus as PrismaProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { ProjectStatus, type Project } from "@/types";

export function makeProject(overrides: Partial<Project> = {}): Project {
  const now = new Date();
  return {
    id: "project_test",
    tenantId: "tenant_test",
    name: "Promo Video",
    status: ProjectStatus.DRAFT,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export async function createTestProject(tenantId: string, legacyClientIdOrName: string, maybeName?: string) {
  const name = maybeName ?? legacyClientIdOrName;
  return prisma.project.create({
    data: {
      tenantId,
      name,
      portalToken: `portal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: PrismaProjectStatus.DRAFT,
    },
  });
}
