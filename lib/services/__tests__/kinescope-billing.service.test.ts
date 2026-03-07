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
      kinescopeProjectId: "project_1",
      billingTrackingStartedAt,
    });
    prisma.kinescopeUsageSnapshot.findUnique.mockResolvedValue(null);
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
      kinescopeProjectId: "project_2",
      billingTrackingStartedAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    prisma.kinescopeUsageSnapshot.findUnique.mockResolvedValue(null);
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
});
