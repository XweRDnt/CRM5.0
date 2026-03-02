import { withAuth } from "@/lib/middleware/auth";
import { handleAPIError } from "@/lib/utils/api-error";
import { assertAdminRequest } from "@/app/api/admin/_helpers";
import { billingPlanService } from "@/lib/services/billing-plan.service";

export const GET = withAuth(async (request) => {
  try {
    await assertAdminRequest(request);
    const plans = await billingPlanService.listPlans();
    return Response.json(plans, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
