import { withAuth } from "@/lib/middleware/auth";
import { assertOwnerOrPm, getWorkspaceForTenant } from "@/lib/services/access-control.service";
import { inviteService } from "@/lib/services/invite.service";
import { handleAPIError } from "@/lib/utils/api-error";

export const GET = withAuth(async (request) => {
  try {
    assertOwnerOrPm(request.user);

    const workspace = await getWorkspaceForTenant(request.user.tenantId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const invites = await inviteService.listActiveInvites(workspace.id);

    return Response.json(
      invites.map((invite) => ({
        id: invite.id,
        token: invite.token,
        url: `/invite/${invite.token}`,
        expiresAt: invite.expiresAt,
        isActive: invite.isActive,
        createdAt: invite.createdAt,
      })),
    );
  } catch (error) {
    return handleAPIError(error);
  }
});

export const POST = withAuth(async (request) => {
  try {
    assertOwnerOrPm(request.user);

    const workspace = await getWorkspaceForTenant(request.user.tenantId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const invite = await inviteService.createInviteLink({
      workspaceId: workspace.id,
      createdBy: request.user.userId,
    });

    return Response.json(
      {
        id: invite.id,
        token: invite.token,
        url: `/invite/${invite.token}`,
        expiresAt: invite.expiresAt,
        isActive: invite.isActive,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleAPIError(error);
  }
});
