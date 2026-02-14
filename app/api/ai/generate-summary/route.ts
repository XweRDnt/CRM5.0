import { NextRequest } from "next/server";
import { aiService } from "@/lib/services/ai.service";
import { ok, fail } from "@/lib/utils/http";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const data = await aiService.generateClientUpdate({ tenantId: "stub-tenant" }, payload);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}