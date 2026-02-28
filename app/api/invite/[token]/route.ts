import { z } from "zod";
import { inviteService } from "@/lib/services/invite.service";
import { handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({
  token: z.string().min(1),
});

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }): Promise<Response> {
  try {
    const { token } = paramsSchema.parse(await context.params);
    const invite = await inviteService.validateInviteToken(token);

    return Response.json({
      token: invite.token,
      workspace: {
        id: invite.workspace.id,
        name: invite.workspace.name,
      },
      expiresAt: invite.expiresAt,
      isActive: invite.isActive,
    });
  } catch (error) {
    return handleAPIError(error);
  }
}
