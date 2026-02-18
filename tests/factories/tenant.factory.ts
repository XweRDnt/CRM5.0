import { prisma } from "@/lib/utils/db";
import type { Tenant } from "@/types";

export function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  const now = new Date();
  return {
    id: "tenant_test",
    name: "Test Agency",
    slug: "test-agency",
    plan: "starter",
    timezone: "UTC",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export async function createTestTenant(slugPrefix: string) {
  return prisma.tenant.create({
    data: {
      name: `Tenant ${slugPrefix}`,
      slug: `${slugPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
  });
}
