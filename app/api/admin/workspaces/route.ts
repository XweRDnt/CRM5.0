import { z } from "zod";
import { BillingPlanCode } from "@prisma/client";
import { withAuth } from "@/lib/middleware/auth";
import { prisma } from "@/lib/utils/db";
import { handleAPIError } from "@/lib/utils/api-error";
import { parseBooleanQuery, assertAdminRequest } from "@/app/api/admin/_helpers";
import { workspaceSubscriptionService } from "@/lib/services/workspace-subscription.service";

const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  plan: z.nativeEnum(BillingPlanCode).optional(),
  blocked: z.boolean().optional(),
});

export const GET = withAuth(async (request) => {
  try {
    await assertAdminRequest(request);

    const url = new URL(request.url);
    const query = listQuerySchema.parse({
      q: url.searchParams.get("q") ?? undefined,
      plan: (url.searchParams.get("plan") as BillingPlanCode | null) ?? undefined,
      blocked: parseBooleanQuery(url.searchParams.get("blocked")),
    });

    const searchValue = query.q?.trim();

    const workspaces = await prisma.workspace.findMany({
      where: {
        OR: searchValue
          ? [
              {
                name: {
                  contains: searchValue,
                  mode: "insensitive",
                },
              },
              {
                owner: {
                  email: {
                    contains: searchValue,
                    mode: "insensitive",
                  },
                },
              },
              {
                owner: {
                  firstName: {
                    contains: searchValue,
                    mode: "insensitive",
                  },
                },
              },
              {
                owner: {
                  lastName: {
                    contains: searchValue,
                    mode: "insensitive",
                  },
                },
              },
            ]
          : undefined,
        isBlocked: query.blocked,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        createdAt: true,
        isBlocked: true,
        billingTrackingStartedAt: true,
        kinescopeProjectId: true,
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        usageSnapshots: {
          orderBy: { fetchedAt: "desc" },
          take: 1,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const payload = await Promise.all(
      workspaces.map(async (workspace) => {
        const subscription = await workspaceSubscriptionService.ensureWorkspaceSubscription(workspace.id);
        if (query.plan && subscription.plan.code !== query.plan) {
          return null;
        }

        const snapshot = workspace.usageSnapshots[0] ?? null;

        return {
          workspaceId: workspace.id,
          tenantId: workspace.tenantId,
          workspaceName: workspace.name,
          owner: {
            userId: workspace.owner.id,
            email: workspace.owner.email,
            fullName: `${workspace.owner.firstName} ${workspace.owner.lastName}`.trim(),
          },
          registeredAt: workspace.createdAt,
          isBlocked: workspace.isBlocked,
          hasDedicatedKinescopeProject: Boolean(workspace.kinescopeProjectId),
          isLegacy: workspace.billingTrackingStartedAt === null,
          billingTrackingStartedAt: workspace.billingTrackingStartedAt,
          subscription,
          usage: snapshot
            ? {
                trafficGb: snapshot.trafficGb ? Number(snapshot.trafficGb.toString()) : 0,
                storageGb: snapshot.storageGb ? Number(snapshot.storageGb.toString()) : 0,
                transcodingMinutes: snapshot.transcodingMinutes ? Number(snapshot.transcodingMinutes.toString()) : 0,
                amountMinor: snapshot.amountMinor ?? 0,
                fetchedAt: snapshot.fetchedAt,
                expiresAt: snapshot.expiresAt,
              }
            : null,
        };
      }),
    );

    return Response.json(payload.filter((item): item is NonNullable<typeof item> => item !== null), { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
