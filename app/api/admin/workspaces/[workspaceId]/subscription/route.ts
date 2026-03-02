import { BillingPlanCode } from "@prisma/client";
import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { handleAPIError } from "@/lib/utils/api-error";
import { assertAdminRequest } from "@/app/api/admin/_helpers";
import { workspaceSubscriptionService } from "@/lib/services/workspace-subscription.service";

const paramsSchema = z.object({
  workspaceId: z.string().min(1),
});

const patchSchema = z.object({
  planCode: z.nativeEnum(BillingPlanCode),
  paymentAmountMinor: z.number().int().min(0),
  paymentCurrency: z.string().min(1).max(12),
  paymentAt: z.string().datetime(),
  paymentComment: z.string().min(1).max(1000),
});

export const PATCH = withAuth(async (request: AuthenticatedRequest, context: { params: Promise<{ workspaceId: string }> }) => {
  try {
    const admin = await assertAdminRequest(request);
    const { workspaceId } = paramsSchema.parse(await context.params);
    const payload = patchSchema.parse(await request.json());

    const updated = await workspaceSubscriptionService.assignWorkspacePlan({
      workspaceId,
      planCode: payload.planCode,
      actorUserId: admin.id,
      paymentAmountMinor: payload.paymentAmountMinor,
      paymentCurrency: payload.paymentCurrency,
      paymentAt: new Date(payload.paymentAt),
      paymentComment: payload.paymentComment,
    });

    return Response.json(updated, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
