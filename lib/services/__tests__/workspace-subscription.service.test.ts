import { beforeEach, describe, expect, it, vi } from "vitest";
import { BillingPlanCode, WorkspaceBillingCycle, WorkspaceSubscriptionStatus } from "@prisma/client";

const prismaMock = {
  workspace: {
    findUnique: vi.fn(),
  },
  billingPlan: {
    findUnique: vi.fn(),
  },
  workspaceSubscription: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  workspaceSubscriptionEvent: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/utils/db", () => ({
  prisma: prismaMock,
}));

function createSubscription(overrides?: Partial<{
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}>) {
  return {
    id: "sub_1",
    workspaceId: "ws_1",
    planCode: BillingPlanCode.FREE,
    status: WorkspaceSubscriptionStatus.ACTIVE,
    cycle: WorkspaceBillingCycle.CALENDAR_MONTH,
    currentPeriodStart: overrides?.currentPeriodStart ?? new Date("2026-03-01T00:00:00.000Z"),
    currentPeriodEnd: overrides?.currentPeriodEnd ?? new Date("2026-04-01T00:00:00.000Z"),
    lastPaymentAmountMinor: null,
    lastPaymentCurrency: null,
    lastPaymentAt: null,
    lastPaymentComment: null,
    updatedAt: new Date("2026-03-10T00:00:00.000Z"),
    plan: {
      code: BillingPlanCode.FREE,
      name: "Free",
      currency: "RUB",
      priceMinor: 0,
      isActive: true,
      sortOrder: 1,
      maxProjects: 1,
      maxMembers: 1,
      maxTrafficGb: null,
      maxStorageGb: null,
      maxTranscodingMinutes: null,
    },
  };
}

describe("WorkspaceSubscriptionService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-10T12:00:00.000Z"));
    prismaMock.workspace.findUnique.mockReset();
    prismaMock.billingPlan.findUnique.mockReset();
    prismaMock.workspaceSubscription.findUnique.mockReset();
    prismaMock.workspaceSubscription.create.mockReset();
    prismaMock.workspaceSubscription.update.mockReset();
    prismaMock.workspaceSubscriptionEvent.create.mockReset();
    prismaMock.$transaction.mockReset();
  });

  it("rolls over an expired calendar-month subscription on read", async () => {
    const { WorkspaceSubscriptionService } = await import("@/lib/services/workspace-subscription.service");
    prismaMock.workspace.findUnique.mockResolvedValue({ id: "ws_1" });
    prismaMock.workspaceSubscription.findUnique.mockResolvedValue(createSubscription());
    prismaMock.workspaceSubscription.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      createSubscription({
        currentPeriodStart: data.currentPeriodStart as Date,
        currentPeriodEnd: data.currentPeriodEnd as Date,
      }),
    );

    const service = new WorkspaceSubscriptionService();
    const result = await service.ensureWorkspaceSubscription("ws_1");

    expect(prismaMock.workspaceSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub_1" },
        data: expect.objectContaining({
          currentPeriodStart: new Date("2026-04-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
          cycle: WorkspaceBillingCycle.CALENDAR_MONTH,
        }),
      }),
    );
    expect(result.currentPeriodStart.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(result.currentPeriodEnd.toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });

  it("returns an active subscription without rollover when the period is still current", async () => {
    const { WorkspaceSubscriptionService } = await import("@/lib/services/workspace-subscription.service");
    prismaMock.workspace.findUnique.mockResolvedValue({ id: "ws_1" });
    prismaMock.workspaceSubscription.findUnique.mockResolvedValue(
      createSubscription({
        currentPeriodStart: new Date("2026-04-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
      }),
    );

    const service = new WorkspaceSubscriptionService();
    const result = await service.ensureWorkspaceSubscription("ws_1");

    expect(prismaMock.workspaceSubscription.update).not.toHaveBeenCalled();
    expect(result.currentPeriodStart.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(result.currentPeriodEnd.toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });
});
