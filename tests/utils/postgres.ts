import { PrismaClient } from "@prisma/client";

const DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/video_crm?schema=public";

export function getTestDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

export async function assertPostgresAvailable(contextMessage: string): Promise<void> {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: getTestDatabaseUrl(),
      },
    },
  });

  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${contextMessage}\nDatabase URL: ${getTestDatabaseUrl()}\nOriginal error: ${details}`,
    );
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}
