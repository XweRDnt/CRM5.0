import { describe, expect, it } from "vitest";
import { WorkspaceSubscriptionEventType } from "@prisma/client";
import { formatEventType, formatUsageReason, sectionTitle } from "../admin-utils";

describe("admin utils copy", () => {
  it("returns readable Russian section titles", () => {
    expect(sectionTitle("overview")).toEqual({
      title: "Обзор",
      description: "Короткий owner-обзор: состояние бизнеса, риски и точки внимания.",
    });
    expect(sectionTitle("plans")).toEqual({
      title: "Тарифы",
      description: "Рабочие тарифы в более чистой и мобильной оболочке.",
    });
  });

  it("formats subscription events with readable labels", () => {
    expect(formatEventType(WorkspaceSubscriptionEventType.PLAN_ASSIGNED)).toBe("Тариф назначен");
    expect(formatEventType(WorkspaceSubscriptionEventType.WORKSPACE_BLOCKED)).toBe("Workspace заблокирован");
  });

  it("formats usage reasons with readable text", () => {
    expect(formatUsageReason("Workspace Kinescope project is not configured")).toBe(
      "У workspace нет выделенного Kinescope project.",
    );
  });
});
