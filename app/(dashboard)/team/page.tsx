import { TeamPageClient } from "@/components/team/TeamPageClient";
import { assertOwnerOrPm, getWorkspaceEditors, getWorkspaceForTenant } from "@/lib/services/access-control.service";
import { inviteService } from "@/lib/services/invite.service";
import { requireServerSession } from "@/lib/server/session";

export default async function TeamPage(): Promise<JSX.Element> {
  const session = await requireServerSession("/team");
  assertOwnerOrPm(session.payload);

  const workspace = await getWorkspaceForTenant(session.payload.tenantId);
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const [members, invites] = await Promise.all([
    getWorkspaceEditors(workspace.id),
    inviteService.listActiveInvites(workspace.id),
  ]);
  type WorkspaceMemberRecord = (typeof members)[number];
  type WorkspaceInviteRecord = (typeof invites)[number];

  return (
    <TeamPageClient
      initialMembers={members.map((member: WorkspaceMemberRecord) => ({
        userId: member.user.id,
        role: member.role,
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        email: member.user.email,
      }))}
      initialInvites={invites.map((invite: WorkspaceInviteRecord) => ({
        id: invite.id,
        token: invite.token,
        url: `/invite/${invite.token}`,
        expiresAt: invite.expiresAt.toISOString(),
        isActive: invite.isActive,
      }))}
    />
  );
}
