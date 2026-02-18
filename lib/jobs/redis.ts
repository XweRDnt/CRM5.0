import Redis, { type RedisOptions } from "ioredis";

type RedisClientRole = "queue" | "worker";

const clients = new Map<RedisClientRole, Redis>();

export function getRedisConnectionOptions(role: RedisClientRole = "queue"): RedisOptions {
  const host = process.env.REDIS_HOST || "localhost";
  const port = Number.parseInt(process.env.REDIS_PORT || "6379", 10);
  const password = process.env.REDIS_PASSWORD?.trim() || undefined;

  return {
    host,
    port,
    password,
    maxRetriesPerRequest: role === "worker" ? null : 3,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  };
}

export function getRedisConnection(role: RedisClientRole = "queue"): Redis {
  const existing = clients.get(role);
  if (existing) {
    return existing;
  }

  const client = new Redis(getRedisConnectionOptions(role));
  client.on("error", (error) => {
    console.error(`[Redis:${role}] connection error`, error);
  });
  client.on("connect", () => {
    console.info(`[Redis:${role}] connected`);
  });

  clients.set(role, client);
  return client;
}

export async function closeRedisConnections(): Promise<void> {
  const closePromises = Array.from(clients.values()).map((client) => client.quit());
  await Promise.allSettled(closePromises);
  clients.clear();
}
