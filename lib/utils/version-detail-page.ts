type VersionMemberRequestKeyOptions = {
  isOwnerOrPm: boolean;
  employeesModalOpen: boolean;
  projectId: string;
};

type VersionMemberRequestKeys = {
  workspaceMembersKey: string | null;
  projectMembersKey: string | null;
};

export function getVersionMemberRequestKeys({
  isOwnerOrPm,
  employeesModalOpen,
  projectId,
}: VersionMemberRequestKeyOptions): VersionMemberRequestKeys {
  if (!isOwnerOrPm || !employeesModalOpen) {
    return {
      workspaceMembersKey: null,
      projectMembersKey: null,
    };
  }

  return {
    workspaceMembersKey: "/api/team/members",
    projectMembersKey: `/api/projects/${projectId}/members`,
  };
}
