import { beforeEach, describe, expect, it, vi } from "vitest";
import { APIError } from "@/lib/utils/api-error";

const prismaMock = {
  workspace: {
    findUnique: vi.fn(),
  },
  workspaceSubscriptionEvent: {
    create: vi.fn(),
  },
  project: {
    count: vi.fn(),
  },
  workspaceMember: {
    count: vi.fn(),
  },
};

const workspaceSubscriptionServiceMock = {
  getWorkspaceSubscription: vi.fn(),
  getWorkspaceSubscriptionByTenant: vi.fn(),
};

const kinescopeBillingServiceMock = {
  getLocalWorkspaceUsageEstimate: vi.fn(),
};

vi.mock("@/lib/utils/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/services/workspace-subscription.service", () => ({
  workspaceSubscriptionService: workspaceSubscriptionServiceMock,
}));

vi.mock("@/lib/services/kinescope-billing.service", () => ({
  kinescopeBillingService: kinescopeBillingServiceMock,
}));

describe("BillingGuardService", () => {
  beforeEach(() => {
    prismaMock.workspace.findUnique.mockReset();
    prismaMock.workspaceSubscriptionEvent.create.mockReset();
    prismaMock.project.count.mockReset();
    prismaMock.workspaceMember.count.mockReset();
    workspaceSubscriptionServiceMock.getWorkspaceSubscription.mockReset();
    workspaceSubscriptionServiceMock.getWorkspaceSubscriptionByTenant.mockReset();
    kinescopeBillingServiceMock.getLocalWorkspaceUsageEstimate.mockReset();

    prismaMock.workspace.findUnique.mockResolvedValue({ id: "ws_1" });
    workspaceSubscriptionServiceMock.getWorkspaceSubscription.mockResolvedValue({
      subscriptionId: "sub_1",
      workspaceId: "ws_1",
      currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
      plan: {
        maxProjects: null,
        maxMembers: null,
        maxTrafficGb: null,
        maxStorageGb: null,
        maxTranscodingMinutes: null,
      },
    });
    kinescopeBillingServiceMock.getLocalWorkspaceUsageEstimate.mockResolvedValue({
      uniqueVideoCount: 0,
      uploadSessionCount: 0,
      assetVersionCount: 0,
      linkedAssetVersionVideoCount: 0,
      standaloneUploadVideoCount: 0,
      videosWithDurationCount: 0,
      periodTranscodingVideoCount: 0,
      periodTranscodingSeconds: 0,
      storageBytes: 0,
      transcodingMinutes: 0,
      trafficGb: 0,
      sampleVideos: [],
    });
  });

  it("blocks upload when projected storage would exceed the plan", async () => {
    const { BillingGuardService } = await import("@/lib/services/billing-guard.service");
    workspaceSubscriptionServiceMock.getWorkspaceSubscription.mockResolvedValue({
      subscriptionId: "sub_1",
      workspaceId: "ws_1",
      currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
      plan: {
        maxProjects: null,
        maxMembers: null,
        maxTrafficGb: null,
        maxStorageGb: 1,
        maxTranscodingMinutes: null,
      },
    });
    kinescopeBillingServiceMock.getLocalWorkspaceUsageEstimate.mockResolvedValue({
      uniqueVideoCount: 1,
      uploadSessionCount: 1,
      assetVersionCount: 1,
      linkedAssetVersionVideoCount: 1,
      standaloneUploadVideoCount: 0,
      videosWithDurationCount: 1,
      periodTranscodingVideoCount: 1,
      periodTranscodingSeconds: 120,
      storageBytes: 950_000_000,
      transcodingMinutes: 2,
      trafficGb: 0,
      sampleVideos: [],
    });

    const service = new BillingGuardService();

    await expect(
      service.assertCanUploadToKinescope({
        tenantId: "tenant_1",
        incomingFileSize: 100_000_000,
        incomingDurationSec: 60,
      }),
    ).rejects.toMatchObject({
      statusCode: 402,
      code: "PLAN_LIMIT_EXCEEDED",
    } satisfies Partial<APIError>);

    expect(prismaMock.workspaceSubscriptionEvent.create).toHaveBeenCalledTimes(1);
  });

  it("blocks upload when projected monthly video minutes would exceed the plan", async () => {
    const { BillingGuardService } = await import("@/lib/services/billing-guard.service");
    workspaceSubscriptionServiceMock.getWorkspaceSubscription.mockResolvedValue({
      subscriptionId: "sub_1",
      workspaceId: "ws_1",
      currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
      plan: {
        maxProjects: null,
        maxMembers: null,
        maxTrafficGb: null,
        maxStorageGb: null,
        maxTranscodingMinutes: 10,
      },
    });
    kinescopeBillingServiceMock.getLocalWorkspaceUsageEstimate.mockResolvedValue({
      uniqueVideoCount: 2,
      uploadSessionCount: 2,
      assetVersionCount: 2,
      linkedAssetVersionVideoCount: 2,
      standaloneUploadVideoCount: 0,
      videosWithDurationCount: 2,
      periodTranscodingVideoCount: 2,
      periodTranscodingSeconds: 590,
      storageBytes: 100_000_000,
      transcodingMinutes: 590 / 60,
      trafficGb: 0,
      sampleVideos: [],
    });

    const service = new BillingGuardService();

    await expect(
      service.assertCanUploadToKinescope({
        tenantId: "tenant_1",
        incomingFileSize: 10_000_000,
        incomingDurationSec: 20,
      }),
    ).rejects.toMatchObject({
      statusCode: 402,
      code: "PLAN_LIMIT_EXCEEDED",
    } satisfies Partial<APIError>);
  });

  it("returns 400 when monthly minutes are enforced but the file duration is missing", async () => {
    const { BillingGuardService } = await import("@/lib/services/billing-guard.service");
    workspaceSubscriptionServiceMock.getWorkspaceSubscription.mockResolvedValue({
      subscriptionId: "sub_1",
      workspaceId: "ws_1",
      currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
      plan: {
        maxProjects: null,
        maxMembers: null,
        maxTrafficGb: null,
        maxStorageGb: null,
        maxTranscodingMinutes: 10,
      },
    });

    const service = new BillingGuardService();

    await expect(
      service.assertCanUploadToKinescope({
        tenantId: "tenant_1",
        incomingFileSize: 10_000_000,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "BAD_REQUEST",
    } satisfies Partial<APIError>);
  });

  it("does not block on traffic-only limits because traffic is informational", async () => {
    const { BillingGuardService } = await import("@/lib/services/billing-guard.service");
    workspaceSubscriptionServiceMock.getWorkspaceSubscription.mockResolvedValue({
      subscriptionId: "sub_1",
      workspaceId: "ws_1",
      currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
      plan: {
        maxProjects: null,
        maxMembers: null,
        maxTrafficGb: 0,
        maxStorageGb: null,
        maxTranscodingMinutes: null,
      },
    });

    const service = new BillingGuardService();

    await expect(
      service.assertCanUploadToKinescope({
        tenantId: "tenant_1",
        incomingFileSize: 10_000_000,
        incomingDurationSec: 30,
      }),
    ).resolves.toBeUndefined();

    expect(kinescopeBillingServiceMock.getLocalWorkspaceUsageEstimate).not.toHaveBeenCalled();
  });
});
