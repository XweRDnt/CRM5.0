import { NextRequest } from "next/server";
import { feedbackService } from "@/lib/services/feedback.service";
import { ok, fail } from "@/lib/utils/http";

export async function PUT(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const data = await feedbackService.updateStatus({ tenantId: "stub-tenant" }, payload);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}