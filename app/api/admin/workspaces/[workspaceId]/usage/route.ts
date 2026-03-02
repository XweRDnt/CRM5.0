import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { APIError, handleAPIError } from "@/lib/utils/api-error";
import { assertAdminRequest, parseBooleanQuery } from "@/app/api/admin/_helpers";
import { kinescopeBillingService } from "@/lib/services/kinescope-billing.service";
import { workspaceSubscriptionService } from "@/lib/services/workspace-subscription.service";

const paramsSchema = z.object({
  workspaceId: z.string().min(1),
});

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  force: z.boolean().optional(),
});

function parseDate(value: string | undefined, field: "from" | "to"): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new APIError(400, `Invalid ${field} datetime`, "BAD_REQUEST");
  }
  return parsed;
}

export const GET = withAuth(async (request: AuthenticatedRequest, context: { params: Promise<{ workspaceId: string }> }) => {
  try {
    await assertAdminRequest(request);
    const { workspaceId } = paramsSchema.parse(await context.params);

    const url = new URL(request.url);
    const query = querySchema.parse({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      force: parseBooleanQuery(url.searchParams.get("force")),
    });

    const subscription = await workspaceSubscriptionService.ensureWorkspaceSubscription(workspaceId);

    const from = parseDate(query.from, "from") ?? subscription.currentPeriodStart;
    const to = parseDate(query.to, "to") ?? subscription.currentPeriodEnd;

    const snapshot = await kinescopeBillingService.getWorkspaceUsageSnapshot({
      workspaceId,
      from,
      to,
      forceRefresh: query.force ?? false,
    });

    return Response.json(
      {
        subscription,
        usage: snapshot,
      },
      { status: 200 },
    );
  } catch (error) {
    return handleAPIError(error);
  }
});
