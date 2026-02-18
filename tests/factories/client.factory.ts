import { prisma } from "@/lib/utils/db";

export async function createTestClient(tenantId: string, email: string, contactName = "Client Contact") {
  return prisma.clientAccount.create({
    data: {
      tenantId,
      companyName: "Client Co",
      contactName,
      email,
    },
  });
}
