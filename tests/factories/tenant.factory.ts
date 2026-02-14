import type { Tenant } from "@/types";

export function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  const now = new Date();
  return {
    id: "tenant_test",
    name: "Test Agency",
    plan: "starter",
    timezone: "UTC",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
