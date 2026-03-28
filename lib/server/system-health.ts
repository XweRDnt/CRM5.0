import { getRedisConnection } from "@/lib/jobs/redis";
import { prisma } from "@/lib/utils/db";

export type DependencyHealth = "ok" | "degraded" | "unknown";

export type SystemHealth = {
  status: "ok" | "degraded";
  dependencies: {
    database: DependencyHealth;
    redis: DependencyHealth;
  };
};

async function checkDatabase(): Promise<DependencyHealth> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "degraded";
  }
}

async function checkRedis(): Promise<DependencyHealth> {
  try {
    const client = getRedisConnection();
    const result = await client.ping();
    return result === "PONG" ? "ok" : "degraded";
  } catch {
    return "degraded";
  }
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  return {
    status: database === "ok" && redis === "ok" ? "ok" : "degraded",
    dependencies: {
      database,
      redis,
    },
  };
}
