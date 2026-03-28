import { ScopeDecisionsPageClient } from "@/components/scope/ScopeDecisionsPageClient";
import { isOwnerOrPm } from "@/lib/services/access-control.service";
import { requireServerSession } from "@/lib/server/session";
import { prisma } from "@/lib/utils/db";
import type { ScopeDecisionResponse } from "@/types";

export default async function ScopeDecisionsPage(): Promise<JSX.Element> {
  const session = await requireServerSession("/scope");
  const decisions = await prisma.scopeDecision.findMany({
    where: {
      project: {
        tenantId: session.payload.tenantId,
        ...(isOwnerOrPm(session.payload.role)
          ? {}
          : {
              members: {
                some: {
                  userId: session.payload.userId,
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

  const initialDecisions: ScopeDecisionResponse[] = decisions.map((decision) => ({
    id: decision.id,
    projectId: decision.projectId,
    feedbackItemId: decision.feedbackItemId,
    aiLabel: decision.aiLabel,
    aiConfidence: decision.aiConfidence,
    aiReasoning: decision.aiReasoning,
    pmDecision: decision.pmDecision,
    pmReason: decision.pmReason,
    changeRequestAmount: decision.changeRequestAmount ? Number(decision.changeRequestAmount) : null,
    decidedBy: decision.pmUser
      ? {
          id: decision.pmUser.id,
          name: `${decision.pmUser.firstName} ${decision.pmUser.lastName}`.trim(),
        }
      : null,
    decidedAt: decision.decidedAt,
    createdAt: decision.createdAt,
    updatedAt: decision.updatedAt,
  }));

  return <ScopeDecisionsPageClient initialDecisions={initialDecisions} />;
}
