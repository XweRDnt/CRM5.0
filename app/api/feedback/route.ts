import { NextRequest } from "next/server";
import { feedbackService } from "@/lib/services/feedback.service";
import { ok, fail } from "@/lib/utils/http";

export async function GET(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const data = await feedbackService.getFeedbackByProject({ tenantId: "stub-tenant" }, payload);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}