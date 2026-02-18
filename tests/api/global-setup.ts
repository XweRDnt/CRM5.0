import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { assertPostgresAvailable } from "@/tests/utils/postgres";

const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.E2E_API_PORT ?? "3100", 10);
const API_URL = process.env.E2E_API_URL ?? `http://${HOST}:${PORT}`;
const HEALTH_URL = `${API_URL}/api/health`;
const START_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 1000;

async function isApiHealthy(): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_URL);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForApiReady(timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isApiHealthy()) {
      return;
    }
    await delay(POLL_INTERVAL_MS);
  }
  throw new Error(
    `API server was not ready in ${timeoutMs}ms. Last checked URL: ${HEALTH_URL}`,
  );
}

async function stopServer(server: ChildProcessWithoutNullStreams): Promise<void> {
  if (server.exitCode !== null) {
    return;
  }

  server.kill("SIGTERM");

  await Promise.race([
    new Promise<void>((resolve) => {
      server.once("exit", () => resolve());
    }),
    delay(10_000),
  ]);

  if (server.exitCode === null) {
    server.kill("SIGKILL");
  }
}

export default async function globalSetup(): Promise<(() => Promise<void>) | void> {
  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL:
      process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/video_crm?schema=public",
    REDIS_DISABLED: process.env.REDIS_DISABLED ?? "true",
    E2E_API_URL: process.env.E2E_API_URL ?? API_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? API_URL,
  });

  await assertPostgresAvailable(
    "API tests require PostgreSQL. Start dependencies with: docker compose up -d postgres redis",
  );

  if (await isApiHealthy()) {
    return;
  }

  const server =
    process.platform === "win32"
      ? spawn(`npm.cmd run dev -- --port ${PORT} --hostname ${HOST}`, {
          cwd: process.cwd(),
          env: process.env,
          stdio: "pipe",
          shell: true,
        })
      : spawn("npm", ["run", "dev", "--", "--port", String(PORT), "--hostname", HOST], {
          cwd: process.cwd(),
          env: process.env,
          stdio: "pipe",
        });

  let lastLogs = "";
  const capture = (chunk: Buffer): void => {
    lastLogs = `${lastLogs}${chunk.toString()}`;
    if (lastLogs.length > 6000) {
      lastLogs = lastLogs.slice(-6000);
    }
  };

  server.stdout.on("data", capture);
  server.stderr.on("data", capture);

  try {
    await waitForApiReady(START_TIMEOUT_MS);
  } catch (error) {
    await stopServer(server);
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(`${details}\nServer logs tail:\n${lastLogs}`);
  }

  return async () => {
    await stopServer(server);
  };
}
