import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { prisma } from "@/lib/utils/db";
import { handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({
  id: z.string().min(1),
});

export const GET = withAuth(async (request: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const stages = await prisma.workflowStage.findMany({
      where: {
        projectId: id,
        project: {
          tenantId: request.user.tenantId,
        },
      },
      orderBy: { createdAt: "asc" },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return Response.json(stages, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
