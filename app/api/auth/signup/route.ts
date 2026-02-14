import { NextRequest } from "next/server";
import { authService } from "@/lib/services/auth.service";
import { ok, fail } from "@/lib/utils/http";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const data = await authService.signup({ tenantId: "stub-tenant" }, payload);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}