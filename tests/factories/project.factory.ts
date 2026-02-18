import { ProjectStatus as PrismaProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { ProjectStatus, type Project } from "@/types";

export function makeProject(overrides: Partial<Project> = {}): Project {
  const now = new Date();
  return {
    id: "project_test",
    tenantId: "tenant_test",
    clientAccountId: "client_test",
    name: "Promo Video",
    status: ProjectStatus.DRAFT,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export async function createTestProject(tenantId: string, clientAccountId: string, name: string) {
  return prisma.project.create({
    data: {
      tenantId,
      clientAccountId,
      name,
      status: PrismaProjectStatus.DRAFT,
    },
  });
}
