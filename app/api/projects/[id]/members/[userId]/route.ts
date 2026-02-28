import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { assertOwnerOrPm } from "@/lib/services/access-control.service";
import { prisma } from "@/lib/utils/db";
import { handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
});

export const DELETE = withAuth(async (request: AuthenticatedRequest, context: { params: Promise<{ id: string; userId: string }> }) => {
  try {
    assertOwnerOrPm(request.user);
    const { id: projectId, userId } = paramsSchema.parse(await context.params);

    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: request.user.tenantId },
      select: { id: true },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    await prisma.projectMember.deleteMany({
      where: {
        projectId,
        userId,
      },
    });

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
