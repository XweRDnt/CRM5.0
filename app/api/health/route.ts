import { getSystemHealth } from "@/lib/server/system-health";
import { ok } from "@/lib/utils/http";

export async function GET() {
  const health = await getSystemHealth();
  return ok(health, health.status === "ok" ? 200 : 503);
}
