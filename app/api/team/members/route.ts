import { withAuth } from "@/lib/middleware/auth";
import { assertOwnerOrPm, getWorkspaceEditors, getWorkspaceForTenant } from "@/lib/services/access-control.service";
import { handleAPIError } from "@/lib/utils/api-error";

export const GET = withAuth(async (request) => {
  try {
    assertOwnerOrPm(request.user);

    const workspace = await getWorkspaceForTenant(request.user.tenantId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const members = await getWorkspaceEditors(workspace.id);

    return Response.json(
      members.map((member) => ({
        userId: member.user.id,
        role: member.role,
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        email: member.user.email,
      })),
    );
  } catch (error) {
    return handleAPIError(error);
  }
});
