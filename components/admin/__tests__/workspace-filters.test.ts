import { describe, expect, it } from "vitest";
import { BillingPlanCode } from "@prisma/client";
import { matchesWorkspaceFilter, resolveWorkspaceFilter } from "../workspace-filters";

const sampleWorkspace = {
  workspaceId: "ws_1",
  tenantId: "tenant_1",
  workspaceName: "Studio Nord",
  owner: {
    userId: "user_1",
    email: "owner@example.com",
    fullName: "Owner",
  },
  registeredAt: "2026-03-10T12:00:00.000Z",
  isBlocked: false,
  hasDedicatedKinescopeProject: true,
  isLegacy: false,
  billingTrackingStartedAt: null,
  subscription: {
    plan: {
      code: BillingPlanCode.FREE,
      name: "Free",
      currency: "RUB",
      priceMinor: 0,
      maxProjects: null,
      maxMembers: null,
      maxTrafficGb: null,
      maxStorageGb: 100,
      maxTranscodingMinutes: 10,
    },
    currentPeriodStart: "2026-03-01T00:00:00.000Z",
    currentPeriodEnd: "2026-04-01T00:00:00.000Z",
  },
  usage: {
    trafficGb: 0,
    storageGb: 85,
    transcodingMinutes: 2,
    amountMinor: 0,
    fetchedAt: "2026-03-28T10:00:00.000Z",
    expiresAt: "2026-03-29T10:00:00.000Z",
  },
} as const;

describe("workspace filters", () => {
  it("normalizes unknown query values to all", () => {
    expect(resolveWorkspaceFilter(null)).toBe("all");
    expect(resolveWorkspaceFilter("weird")).toBe("all");
    expect(resolveWorkspaceFilter("high")).toBe("high");
  });

  it("matches high-usage workspaces by usage percentage", () => {
    expect(matchesWorkspaceFilter(sampleWorkspace, "high")).toBe(true);
    expect(matchesWorkspaceFilter(sampleWorkspace, "paid")).toBe(false);
    expect(matchesWorkspaceFilter(sampleWorkspace, "free")).toBe(true);
  });

  it("treats inactive as workspaces with no relevant usage", () => {
    expect(
      matchesWorkspaceFilter(
        {
          ...sampleWorkspace,
          usage: {
            ...sampleWorkspace.usage,
            storageGb: 0,
            transcodingMinutes: 0,
            trafficGb: 0,
          },
        },
        "inactive",
      ),
    ).toBe(true);
  });
});
