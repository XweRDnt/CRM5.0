type VersionMemberRequestKeyOptions = {
  isOwnerOrPm: boolean;
  employeesModalOpen: boolean;
  projectId: string;
};

type VersionMemberRequestKeys = {
  workspaceMembersKey: string | null;
  projectMembersKey: string | null;
};

type VersionDetailPageStateInput = {
  projectLoading: boolean;
  versionsLoading: boolean;
  hasProject: boolean;
  projectErrorMessage: string | null;
  versionsErrorMessage: string | null;
};

type VersionDetailPageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready" };

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

export function getVersionDetailPageState({
  projectLoading,
  versionsLoading,
  hasProject,
  projectErrorMessage,
  versionsErrorMessage,
}: VersionDetailPageStateInput): VersionDetailPageState {
  if (projectLoading || versionsLoading) {
    return { kind: "loading" };
  }

  if (projectErrorMessage) {
    return { kind: "error", message: projectErrorMessage };
  }

  if (versionsErrorMessage) {
    return { kind: "error", message: versionsErrorMessage };
  }

  if (!hasProject) {
    return { kind: "error", message: "Не удалось загрузить проект." };
  }

  return { kind: "ready" };
}
