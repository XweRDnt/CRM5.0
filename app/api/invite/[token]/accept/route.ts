import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { inviteService } from "@/lib/services/invite.service";
import { handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({
  token: z.string().min(1),
});

export const POST = withAuth(async (request: AuthenticatedRequest, context: { params: Promise<{ token: string }> }) => {
  try {
    const { token } = paramsSchema.parse(await context.params);
    const invite = await inviteService.acceptInvite({
      token,
      userId: request.user.userId,
    });

    return Response.json({
      success: true,
      workspace: {
        id: invite.workspace.id,
        name: invite.workspace.name,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "User belongs to another workspace") {
      return Response.json(
        { error: "User already belongs to another workspace", code: "CONFLICT" },
        { status: 409 },
      );
    }

    return handleAPIError(error);
  }
});
