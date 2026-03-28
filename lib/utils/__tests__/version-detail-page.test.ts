import { describe, expect, it } from "vitest";

import { getVersionMemberRequestKeys } from "@/lib/utils/version-detail-page";

describe("getVersionMemberRequestKeys", () => {
  it("skips member requests for non managers", () => {
    expect(getVersionMemberRequestKeys({ isOwnerOrPm: false, employeesModalOpen: false, projectId: "project-1" })).toEqual({
      projectMembersKey: null,
      workspaceMembersKey: null,
    });
  });

  it("skips member requests until the employees modal is open", () => {
    expect(getVersionMemberRequestKeys({ isOwnerOrPm: true, employeesModalOpen: false, projectId: "project-1" })).toEqual({
      projectMembersKey: null,
      workspaceMembersKey: null,
    });
  });

  it("returns both request keys once a manager opens the employees modal", () => {
    expect(getVersionMemberRequestKeys({ isOwnerOrPm: true, employeesModalOpen: true, projectId: "project-1" })).toEqual({
      projectMembersKey: "/api/projects/project-1/members",
      workspaceMembersKey: "/api/team/members",
    });
  });
});
