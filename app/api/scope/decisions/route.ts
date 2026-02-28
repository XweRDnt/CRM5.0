import { z } from "zod";
import { withAuth } from "@/lib/middleware/auth";
import { assertProjectAccess, isOwnerOrPm } from "@/lib/services/access-control.service";
import { ScopeGuardService } from "@/lib/services/scope-guard.service";
import { prisma } from "@/lib/utils/db";
import { handleAPIError } from "@/lib/utils/api-error";

const listDecisionsSchema = z.object({
  projectId: z.string().min(1).optional(),
});

export const GET = withAuth(async (request) => {
  try {
    const query = listDecisionsSchema.parse({
      projectId: new URL(request.url).searchParams.get("projectId") ?? undefined,
    });

    if (query.projectId) {
      await assertProjectAccess(request.user, query.projectId);
      const scopeGuardService = new ScopeGuardService(prisma);
      const decisions = await scopeGuardService.listScopeDecisionsByProject(query.projectId, request.user.tenantId);
      return Response.json(decisions, { status: 200 });
    }

    const decisions = await prisma.scopeDecision.findMany({
      where: {
        project: {
          tenantId: request.user.tenantId,
          ...(isOwnerOrPm(request.user.role)
            ? {}
            : {
                members: {
                  some: {
                    userId: request.user.userId,
                  },
                },
              }),
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        pmUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return Response.json(decisions, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
