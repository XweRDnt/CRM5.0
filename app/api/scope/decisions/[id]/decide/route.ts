import { z } from "zod";
import { PMDecision } from "@prisma/client";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { ScopeGuardService } from "@/lib/services/scope-guard.service";
import { prisma } from "@/lib/utils/db";
import { APIError, handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const makeDecisionSchema = z.object({
  decision: z.nativeEnum(PMDecision),
  reason: z.string().max(5000).optional(),
  changeRequestAmount: z.number().nonnegative().optional(),
});

export const POST = withAuth(async (request: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    if (request.user.role !== "OWNER" && request.user.role !== "PM") {
      throw new APIError(403, "Forbidden", "FORBIDDEN");
    }

    const { id } = paramsSchema.parse(await context.params);
    const payload = makeDecisionSchema.parse(await request.json());

    const scopeGuardService = new ScopeGuardService(prisma);
    const decision = await scopeGuardService.makePMDecision({
      scopeDecisionId: id,
      tenantId: request.user.tenantId,
      pmUserId: request.user.userId,
      decision: payload.decision,
      reason: payload.reason,
      changeRequestAmount: payload.changeRequestAmount,
    });

    return Response.json(decision, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
