import { describe, expect, it } from "vitest";

import { getVersionDetailPageState } from "@/lib/utils/version-detail-page";

describe("getVersionDetailPageState", () => {
  it("returns loading while project or versions are still loading", () => {
    expect(
      getVersionDetailPageState({
        projectLoading: true,
        versionsLoading: false,
        hasProject: false,
        projectErrorMessage: null,
        versionsErrorMessage: null,
      }),
    ).toEqual({ kind: "loading" });
  });

  it("returns an error state instead of infinite loading when the project request fails", () => {
    expect(
      getVersionDetailPageState({
        projectLoading: false,
        versionsLoading: false,
        hasProject: false,
        projectErrorMessage: "Project not found",
        versionsErrorMessage: null,
      }),
    ).toEqual({
      kind: "error",
      message: "Project not found",
    });
  });

  it("returns an error state when the versions request fails", () => {
    expect(
      getVersionDetailPageState({
        projectLoading: false,
        versionsLoading: false,
        hasProject: true,
        projectErrorMessage: null,
        versionsErrorMessage: "Forbidden",
      }),
    ).toEqual({
      kind: "error",
      message: "Forbidden",
    });
  });

  it("returns ready when the required data is available", () => {
    expect(
      getVersionDetailPageState({
        projectLoading: false,
        versionsLoading: false,
        hasProject: true,
        projectErrorMessage: null,
        versionsErrorMessage: null,
      }),
    ).toEqual({ kind: "ready" });
  });
});
