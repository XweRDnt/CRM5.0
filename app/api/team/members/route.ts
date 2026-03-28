import { withAuth } from "@/lib/middleware/auth";
import { assertOwnerOrPm, getWorkspaceEditors, getWorkspaceForTenant } from "@/lib/services/access-control.service";
import { handleAPIError } from "@/lib/utils/api-error";
import { withServerTiming } from "@/lib/utils/server-timing";

export const GET = withAuth(async (request) =>
  withServerTiming("api-team-members", async () => {
    try {
      assertOwnerOrPm(request.user);

      const workspace = await getWorkspaceForTenant(request.user.tenantId);
      if (!workspace) {
        throw new Error("Workspace not found");
      }

      const members = await getWorkspaceEditors(workspace.id);
      type WorkspaceMemberRecord = (typeof members)[number];

      return Response.json(
        members.map((member: WorkspaceMemberRecord) => ({
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
  }),
);
