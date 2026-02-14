import { NextRequest } from "next/server";
import { subscriptionService } from "@/lib/services/subscription.service";
import { ok, fail } from "@/lib/utils/http";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const data = await subscriptionService.handleStripeWebhook({ tenantId: "stub-tenant" }, payload);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}