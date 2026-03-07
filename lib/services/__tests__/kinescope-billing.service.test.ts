import { describe, expect, it, beforeEach, vi } from "vitest";
import { KinescopeBillingService } from "@/lib/services/kinescope-billing.service";

type MockedPrisma = {
  workspace: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  kinescopeUsageSnapshot: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  videoUploadSession: {
    findMany: ReturnType<typeof vi.fn>;
  };
  assetVersion: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

function createPrismaMock(): MockedPrisma {
  return {
    workspace: {
      findUnique: vi.fn(),
    },
    kinescopeUsageSnapshot: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    videoUploadSession: {
      findMany: vi.fn(),
    },
    assetVersion: {
      findMany: vi.fn(),
    },
  };
}

describe("KinescopeBillingService", () => {
  beforeEach(() => {
    process.env.KINESCOPE_API_TOKEN = "test-token";
    process.env.KINESCOPE_BASE_URL = "https://api.kinescope.local/v1";
    vi.restoreAllMocks();
  });

  it("parses official billing usage rows by product and converts bytes to GB", async () => {
    const prisma = createPrismaMock();
    const billingTrackingStartedAt = new Date("2026-03-01T00:00:00.000Z");
    const periodStart = new Date("2026-03-01T00:00:00.000Z");
    const periodEnd = new Date("2026-04-01T00:00:00.000Z");

    prisma.workspace.findUnique.mockResolvedValue({
      id: "ws_1",
      tenantId: "tenant_1",
      kinescopeProjectId: "project_1",
      billingTrackingStartedAt,
    });
    prisma.kinescopeUsageSnapshot.findUnique.mockResolvedValue(null);
    prisma.videoUploadSession.findMany.mockResolvedValue([]);
    prisma.assetVersion.findMany.mockResolvedValue([]);
    prisma.kinescopeUsageSnapshot.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
      workspaceId: create.workspaceId,
      periodStart: create.periodStart,
      periodEnd: create.periodEnd,
      trafficGb: create.trafficGb,
      storageGb: create.storageGb,
      transcodingMinutes: create.transcodingMinutes,
      amountMinor: create.amountMinor,
      fetchedAt: new Date("2026-03-07T15:00:00.000Z"),
      expiresAt: create.expiresAt,
    }));

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof URL ? input : new URL(String(input));
      expect(url.searchParams.get("project_id")).toBe("project_1");
      expect(url.searchParams.get("group_by")).toBe("project_id");

      return new Response(
        JSON.stringify({
          data: [
            {
              date: "2026-03-07T00:00:00Z",
              usage: 100_000_000,
              product: "storage",
              project_id: "project_1",
            },
            {
              date: "2026-03-07T00:00:00Z",
              usage: 2_500_000_000,
              product: "cdn",
              project_id: "project_1",
            },
            {
              date: "2026-03-07T00:00:00Z",
              usage: 3.5,
              product: "encoding",
            },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = new KinescopeBillingService(prisma as never);
    const snapshot = await service.getWorkspaceUsageSnapshot({
      workspaceId: "ws_1",
      from: periodStart,
      to: periodEnd,
      forceRefresh: true,
    });

    expect(snapshot.storageGb).toBeCloseTo(0.1, 5);
    expect(snapshot.trafficGb).toBeCloseTo(2.5, 5);
    expect(snapshot.transcodingMinutes).toBeCloseTo(3.5, 5);
    expect(snapshot.source).toBe("live");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps backward compatibility with aggregated gb fields", async () => {
    const prisma = createPrismaMock();

    prisma.workspace.findUnique.mockResolvedValue({
      id: "ws_2",
      tenantId: "tenant_2",
      kinescopeProjectId: "project_2",
      billingTrackingStartedAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    prisma.kinescopeUsageSnapshot.findUnique.mockResolvedValue(null);
    prisma.videoUploadSession.findMany.mockResolvedValue([]);
    prisma.assetVersion.findMany.mockResolvedValue([]);
    prisma.kinescopeUsageSnapshot.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
      workspaceId: create.workspaceId,
      periodStart: create.periodStart,
      periodEnd: create.periodEnd,
      trafficGb: create.trafficGb,
      storageGb: create.storageGb,
      transcodingMinutes: create.transcodingMinutes,
      amountMinor: create.amountMinor,
      fetchedAt: new Date("2026-03-07T15:00:00.000Z"),
      expiresAt: create.expiresAt,
    }));

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                project_id: "project_2",
                traffic_gb: 1.25,
                storage_gb: 0.75,
                transcoding_minutes: 12,
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const service = new KinescopeBillingService(prisma as never);
    const snapshot = await service.getWorkspaceUsageSnapshot({
      workspaceId: "ws_2",
      from: new Date("2026-03-01T00:00:00.000Z"),
      to: new Date("2026-04-01T00:00:00.000Z"),
      forceRefresh: true,
    });

    expect(snapshot.trafficGb).toBeCloseTo(1.25, 5);
    expect(snapshot.storageGb).toBeCloseTo(0.75, 5);
    expect(snapshot.transcodingMinutes).toBeCloseTo(12, 5);
  });

  it("uses the latest storage snapshot instead of summing daily storage rows", async () => {
    const prisma = createPrismaMock();

    prisma.workspace.findUnique.mockResolvedValue({
      id: "ws_3",
      tenantId: "tenant_3",
      kinescopeProjectId: "project_3",
      billingTrackingStartedAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    prisma.kinescopeUsageSnapshot.findUnique.mockResolvedValue(null);
    prisma.videoUploadSession.findMany.mockResolvedValue([]);
    prisma.assetVersion.findMany.mockResolvedValue([]);
    prisma.kinescopeUsageSnapshot.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
      workspaceId: create.workspaceId,
      periodStart: create.periodStart,
      periodEnd: create.periodEnd,
      trafficGb: create.trafficGb,
      storageGb: create.storageGb,
      transcodingMinutes: create.transcodingMinutes,
      amountMinor: create.amountMinor,
      fetchedAt: new Date("2026-03-07T15:00:00.000Z"),
      expiresAt: create.expiresAt,
    }));

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                date: "2026-03-05T00:00:00Z",
                usage: 100_000_000,
                product: "storage",
                project_id: "project_3",
              },
              {
                date: "2026-03-06T00:00:00Z",
                usage: 100_000_000,
                product: "storage",
                project_id: "project_3",
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const service = new KinescopeBillingService(prisma as never);
    const snapshot = await service.getWorkspaceUsageSnapshot({
      workspaceId: "ws_3",
      from: new Date("2026-03-01T00:00:00.000Z"),
      to: new Date("2026-04-01T00:00:00.000Z"),
      forceRefresh: true,
    });

    expect(snapshot.storageGb).toBeCloseTo(0.1, 5);
  });

  it("falls back to local workspace usage when Kinescope returns only account-level rows", async () => {
    const prisma = createPrismaMock();

    prisma.workspace.findUnique.mockResolvedValue({
      id: "ws_4",
      tenantId: "tenant_4",
      kinescopeProjectId: "project_4",
      billingTrackingStartedAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    prisma.kinescopeUsageSnapshot.findUnique.mockResolvedValue(null);
    prisma.videoUploadSession.findMany.mockResolvedValue([
      {
        kinescopeVideoId: "video_a",
        fileName: "video-a.mp4",
        fileSize: 104_857_600,
        status: "READY",
        streamUrl: "https://kinescope.io/video_a",
        durationSec: 300,
        createdAt: new Date("2026-03-06T12:00:00.000Z"),
      },
      {
        kinescopeVideoId: "video_b",
        fileName: "video-b.mp4",
        fileSize: 52_428_800,
        status: "PROCESSING",
        streamUrl: "https://kinescope.io/video_b",
        durationSec: 120,
        createdAt: new Date("2026-03-07T12:00:00.000Z"),
      },
    ]);
    prisma.assetVersion.findMany.mockResolvedValue([]);
    prisma.kinescopeUsageSnapshot.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
      workspaceId: create.workspaceId,
      periodStart: create.periodStart,
      periodEnd: create.periodEnd,
      trafficGb: create.trafficGb,
      storageGb: create.storageGb,
      transcodingMinutes: create.transcodingMinutes,
      amountMinor: create.amountMinor,
      rawJson: create.rawJson,
      fetchedAt: new Date("2026-03-07T15:00:00.000Z"),
      expiresAt: create.expiresAt,
    }));

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount += 1;

        if (callCount === 1) {
          return new Response(JSON.stringify({ data: [] }), { status: 200 });
        }

        return new Response(
          JSON.stringify({
            data: [
              {
                date: "2026-03-07T00:00:00Z",
                usage: 123,
                product: "storage",
              },
            ],
          }),
          { status: 200 },
        );
      }),
    );

    const service = new KinescopeBillingService(prisma as never);
    const snapshot = await service.getWorkspaceUsageSnapshot({
      workspaceId: "ws_4",
      from: new Date("2026-03-01T00:00:00.000Z"),
      to: new Date("2026-04-01T00:00:00.000Z"),
      forceRefresh: true,
    });

    expect(snapshot.source).toBe("local");
    expect(snapshot.reason).toBe("Using local workspace estimate because Kinescope billing API returned only account-level rows");
    expect(snapshot.storageGb).toBeCloseTo(0.1572864, 5);
    expect(snapshot.transcodingMinutes).toBeCloseTo(7, 5);
    expect(snapshot.localEstimate?.uniqueVideoCount).toBe(2);
    expect(snapshot.localEstimate?.linkedAssetVersionVideoCount).toBe(0);
    expect(snapshot.localEstimate?.standaloneUploadVideoCount).toBe(2);
    expect(snapshot.localEstimate?.sampleVideos).toHaveLength(2);
  });

  it("merges local fallback data from upload sessions and asset versions", async () => {
    const prisma = createPrismaMock();

    prisma.workspace.findUnique.mockResolvedValue({
      id: "ws_5",
      tenantId: "tenant_5",
      kinescopeProjectId: "project_5",
      billingTrackingStartedAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    prisma.kinescopeUsageSnapshot.findUnique.mockResolvedValue(null);
    prisma.videoUploadSession.findMany.mockResolvedValue([
      {
        kinescopeVideoId: "video_shared",
        fileName: "shared-from-session.mp4",
        fileSize: 80_000_000,
        status: "READY",
        streamUrl: "https://kinescope.io/video_shared",
        durationSec: null,
        createdAt: new Date("2026-03-07T09:00:00.000Z"),
      },
      {
        kinescopeVideoId: "video_only_session",
        fileName: "session-only.mp4",
        fileSize: 20_000_000,
        status: "READY",
        streamUrl: "https://kinescope.io/video_only_session",
        durationSec: 180,
        createdAt: new Date("2026-02-27T09:00:00.000Z"),
      },
    ]);
    prisma.assetVersion.findMany.mockResolvedValue([
      {
        kinescopeVideoId: "video_shared",
        fileName: "shared-from-version.mp4",
        fileSize: 120_000_000,
        durationSec: 240,
        createdAt: new Date("2026-03-07T10:00:00.000Z"),
      },
    ]);
    prisma.kinescopeUsageSnapshot.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
      workspaceId: create.workspaceId,
      periodStart: create.periodStart,
      periodEnd: create.periodEnd,
      trafficGb: create.trafficGb,
      storageGb: create.storageGb,
      transcodingMinutes: create.transcodingMinutes,
      amountMinor: create.amountMinor,
      rawJson: create.rawJson,
      fetchedAt: new Date("2026-03-07T15:00:00.000Z"),
      expiresAt: create.expiresAt,
    }));

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount += 1;

        if (callCount === 1) {
          return new Response(JSON.stringify({ data: [] }), { status: 200 });
        }

        return new Response(
          JSON.stringify({
            data: [
              {
                date: "2026-03-07T00:00:00Z",
                usage: 123,
                product: "storage",
              },
            ],
          }),
          { status: 200 },
        );
      }),
    );

    const service = new KinescopeBillingService(prisma as never);
    const snapshot = await service.getWorkspaceUsageSnapshot({
      workspaceId: "ws_5",
      from: new Date("2026-03-01T00:00:00.000Z"),
      to: new Date("2026-04-01T00:00:00.000Z"),
      forceRefresh: true,
    });

    expect(snapshot.source).toBe("local");
    expect(snapshot.storageGb).toBeCloseTo(0.14, 5);
    expect(snapshot.transcodingMinutes).toBeCloseTo(4, 5);
    expect(snapshot.localEstimate?.uniqueVideoCount).toBe(2);
    expect(snapshot.localEstimate?.assetVersionCount).toBe(1);
    expect(snapshot.localEstimate?.uploadSessionCount).toBe(2);
    expect(snapshot.localEstimate?.linkedAssetVersionVideoCount).toBe(1);
    expect(snapshot.localEstimate?.standaloneUploadVideoCount).toBe(1);
    expect(snapshot.localEstimate?.videosWithDurationCount).toBe(2);
    expect(snapshot.localEstimate?.periodTranscodingVideoCount).toBe(1);
    expect(snapshot.localEstimate?.sampleVideos[0]?.kinescopeVideoId).toBe("video_shared");
    expect(snapshot.localEstimate?.sampleVideos[0]?.fileSize).toBe(120_000_000);
    expect(snapshot.localEstimate?.sampleVideos[0]?.durationSec).toBe(240);
  });

  it("ignores stale uploading sessions that were never confirmed or linked to an asset version", async () => {
    const prisma = createPrismaMock();

    prisma.workspace.findUnique.mockResolvedValue({
      id: "ws_6",
      tenantId: "tenant_6",
      kinescopeProjectId: "project_6",
      billingTrackingStartedAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    prisma.kinescopeUsageSnapshot.findUnique.mockResolvedValue(null);
    prisma.videoUploadSession.findMany.mockResolvedValue([
      {
        kinescopeVideoId: "video_stale",
        fileName: "stale.mp4",
        fileSize: 50_000_000,
        status: "UPLOADING",
        streamUrl: null,
        durationSec: null,
        createdAt: new Date("2026-03-07T09:00:00.000Z"),
      },
      {
        kinescopeVideoId: "video_ready",
        fileName: "ready.mp4",
        fileSize: 40_000_000,
        status: "READY",
        streamUrl: "https://kinescope.io/video_ready",
        durationSec: 90,
        createdAt: new Date("2026-03-07T10:00:00.000Z"),
      },
    ]);
    prisma.assetVersion.findMany.mockResolvedValue([]);
    prisma.kinescopeUsageSnapshot.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
      workspaceId: create.workspaceId,
      periodStart: create.periodStart,
      periodEnd: create.periodEnd,
      trafficGb: create.trafficGb,
      storageGb: create.storageGb,
      transcodingMinutes: create.transcodingMinutes,
      amountMinor: create.amountMinor,
      rawJson: create.rawJson,
      fetchedAt: new Date("2026-03-07T15:00:00.000Z"),
      expiresAt: create.expiresAt,
    }));

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount += 1;

        if (callCount === 1) {
          return new Response(JSON.stringify({ data: [] }), { status: 200 });
        }

        return new Response(
          JSON.stringify({
            data: [
              {
                date: "2026-03-07T00:00:00Z",
                usage: 123,
                product: "storage",
              },
            ],
          }),
          { status: 200 },
        );
      }),
    );

    const service = new KinescopeBillingService(prisma as never);
    const snapshot = await service.getWorkspaceUsageSnapshot({
      workspaceId: "ws_6",
      from: new Date("2026-03-01T00:00:00.000Z"),
      to: new Date("2026-04-01T00:00:00.000Z"),
      forceRefresh: true,
    });

    expect(snapshot.source).toBe("local");
    expect(snapshot.storageGb).toBeCloseTo(0.04, 5);
    expect(snapshot.transcodingMinutes).toBeCloseTo(1.5, 5);
    expect(snapshot.localEstimate?.uniqueVideoCount).toBe(1);
    expect(snapshot.localEstimate?.standaloneUploadVideoCount).toBe(1);
  });
});
