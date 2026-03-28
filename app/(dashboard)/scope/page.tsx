import { ScopeDecisionsPageClient } from "@/components/scope/ScopeDecisionsPageClient";
import { isOwnerOrPm } from "@/lib/services/access-control.service";
import { requireServerSession } from "@/lib/server/session";
import { prisma } from "@/lib/utils/db";

export default async function ScopeDecisionsPage(): Promise<JSX.Element> {
  const session = await requireServerSession("/scope");
  const initialDecisions = await prisma.scopeDecision.findMany({
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

  return <ScopeDecisionsPageClient initialDecisions={initialDecisions} />;
}
