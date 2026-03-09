import { beforeEach, describe, expect, it, vi } from "vitest";
import { VideoProcessingStatus } from "@prisma/client";
import { KinescopeService } from "@/lib/services/kinescope.service";

type PrismaMock = {
  project: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  videoUploadSession: {
    upsert: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  assetVersion: {
    updateMany: ReturnType<typeof vi.fn>;
  };
};

function createPrismaMock(): PrismaMock {
  return {
    project: {
      findFirst: vi.fn(),
    },
    videoUploadSession: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    assetVersion: {
      updateMany: vi.fn(),
    },
  };
}

describe("KinescopeService duration handling", () => {
  beforeEach(() => {
    process.env.KINESCOPE_API_TOKEN = "test-token";
    process.env.KINESCOPE_PARENT_ID = "parent_123";
    process.env.KINESCOPE_PROJECT_ID = "proj_123";
    process.env.KINESCOPE_BASE_URL = "https://api.kinescope.local/v1";
    process.env.KINESCOPE_UPLOADER_BASE_URL = "https://uploader.kinescope.local/v2";
    vi.restoreAllMocks();
  });

  it("stores the client-estimated duration on upload init", async () => {
    const prisma = createPrismaMock();
    prisma.project.findFirst.mockResolvedValue({ id: "project_1" });
    prisma.videoUploadSession.upsert.mockResolvedValue({});

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: {
              id: "video_123",
              endpoint: "https://uploader.kinescope.local/upload/video_123",
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const service = new KinescopeService(prisma as never);
    await service.createUploadSession(
      { tenantId: "tenant_1" },
      {
        projectId: "project_1",
        fileName: "video.mp4",
        fileType: "video/mp4",
        fileSize: 1_000,
        durationSec: 30,
      },
    );

    expect(prisma.videoUploadSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          durationSec: 30,
        }),
        create: expect.objectContaining({
          durationSec: 30,
        }),
      }),
    );
  });

  it("overwrites the estimated duration with the actual duration on confirm", async () => {
    const prisma = createPrismaMock();
    prisma.project.findFirst.mockResolvedValue({ id: "project_1" });
    prisma.videoUploadSession.findFirst.mockResolvedValue({ id: "session_1" });
    prisma.videoUploadSession.update.mockResolvedValue({});

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: "video_123",
            status: "ready",
            duration_sec: 42,
            playback: { url: "https://kinescope.io/video_123" },
          }),
          { status: 200 },
        ),
      ),
    );

    const service = new KinescopeService(prisma as never);
    const result = await service.confirmUpload(
      { tenantId: "tenant_1" },
      {
        projectId: "project_1",
        kinescopeVideoId: "video_123",
      },
    );

    expect(result.processingStatus).toBe(VideoProcessingStatus.READY);
    expect(result.durationSec).toBe(42);
    expect(prisma.videoUploadSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          durationSec: 42,
        }),
      }),
    );
  });
});
