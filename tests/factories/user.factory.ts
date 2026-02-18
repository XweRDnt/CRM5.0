import { UserRole as PrismaUserRole } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { UserRole, type User } from "@/types";

export function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id: "user_test",
    tenantId: "tenant_test",
    role: UserRole.PM,
    firstName: "Test",
    lastName: "PM",
    email: "pm@example.com",
    passwordHash: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export async function createTestUser(tenantId: string, email: string, firstName = "Test", lastName = "User") {
  return prisma.user.create({
    data: {
      tenantId,
      role: PrismaUserRole.PM,
      firstName,
      lastName,
      email,
    },
  });
}
