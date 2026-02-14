import { UserRole, type User } from "@/types";

export function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id: "user_test",
    tenantId: "tenant_test",
    role: UserRole.PM,
    name: "Test PM",
    email: "pm@example.com",
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
