import { BillingPlanCode } from "@prisma/client";
import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { handleAPIError } from "@/lib/utils/api-error";
import { assertAdminRequest } from "@/app/api/admin/_helpers";
import { billingPlanService } from "@/lib/services/billing-plan.service";

const paramsSchema = z.object({
  code: z.nativeEnum(BillingPlanCode),
});

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  currency: z.string().min(1).max(12).optional(),
  priceMinor: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  maxProjects: z.number().int().min(0).nullable().optional(),
  maxMembers: z.number().int().min(0).nullable().optional(),
  maxTrafficGb: z.number().nonnegative().nullable().optional(),
  maxStorageGb: z.number().nonnegative().nullable().optional(),
  maxTranscodingMinutes: z.number().nonnegative().nullable().optional(),
});

export const PATCH = withAuth(async (request: AuthenticatedRequest, context: { params: Promise<{ code: string }> }) => {
  try {
    await assertAdminRequest(request);
    const { code } = paramsSchema.parse(await context.params);
    const payload = patchSchema.parse(await request.json());
    const updated = await billingPlanService.updatePlan(code, payload);
    return Response.json(updated, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
