import { ok } from "@/lib/utils/http";

export async function GET() {
  return ok({ status: "ok" });
}
