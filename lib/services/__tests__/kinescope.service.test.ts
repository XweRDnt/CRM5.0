import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { UserRole, VideoProcessingStatus, VideoProvider } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { KinescopeService } from "@/lib/services/kinescope.service";

async function createTenant(slugPrefix: string) {
  return prisma.tenant.create({
    data: {
      name: `Tenant ${slugPrefix}`,
      slug: `${slugPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
  });
}

async function createClient(tenantId: string, email: string) {
  return prisma.clientAccount.create({
    data: {
      tenantId,
      companyName: "Client Co",
      contactName: "Client Contact",
      email,
    },
  });
}

async function createProject(tenantId: string, clientAccountId: string, name: string) {
  return prisma.project.create({
    data: {
      tenantId,
      clientAccountId,
      name,
    },
  });
}

async function createUser(tenantId: string, email: string) {
  return prisma.user.create({
    data: {
      tenantId,
      role: UserRole.PM,
      firstName: "Video",
      lastName: "Manager",
      email,
    },
  });
}

async function cleanup() {
  await prisma.feedbackItem.deleteMany();
  await prisma.assetVersion.deleteMany();
  await prisma.videoUploadSession.deleteMany();
  await prisma.project.deleteMany();
  await prisma.clientAccount.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

describe("KinescopeService", () => {
  beforeEach(async () => {
    process.env.KINESCOPE_API_TOKEN = "test-token";
    process.env.KINESCOPE_PARENT_ID = "parent_123";
    process.env.KINESCOPE_PROJECT_ID = "proj_123";
    process.env.KINESCOPE_UPLOADING_LOCATION_ID = "loc_123";
    process.env.KINESCOPE_BASE_URL = "https://api.kinescope.local/v1";
    process.env.KINESCOPE_UPLOADER_BASE_URL = "https://uploader.kinescope.local/v2";
    process.env.KINESCOPE_WEBHOOK_SECRET = "secret";
    await cleanup();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("creates upload session and persists tenant/project mapping", async () => {
    const tenant = await createTenant("kinescope-1");
    const client = await createClient(tenant.id, "client-k1@example.com");
    const project = await createProject(tenant.id, client.id, "Project");
    const service = new KinescopeService();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse((init?.body as string | undefined) ?? "{}") as Record<string, unknown>;
        expect(body.parent_id).toBe("parent_123");
        expect(body.filesize).toBe(1000);
        return new Response(
          JSON.stringify({
            data: {
              id: "video_123",
              endpoint: "https://uploader.kinescope.local/upload/video_123",
            },
          }),
          { status: 200 },
        );
      }),
    );

    const session = await service.createUploadSession(
      { tenantId: tenant.id },
      {
        projectId: project.id,
        fileName: "v1.mp4",
        fileType: "video/mp4",
        fileSize: 1000,
      },
    );

    expect(session.kinescopeVideoId).toBe("video_123");
    expect(session.uploadMethod).toBe("POST");
    expect(session.uploadUrl).toContain("uploader.kinescope.local");
    const dbSession = await prisma.videoUploadSession.findUnique({ where: { kinescopeVideoId: "video_123" } });
    expect(dbSession?.tenantId).toBe(tenant.id);
    expect(dbSession?.projectId).toBe(project.id);
    expect(dbSession?.status).toBe(VideoProcessingStatus.UPLOADING);
  });

  it("confirms upload and maps READY status", async () => {
    const tenant = await createTenant("kinescope-2");
    const client = await createClient(tenant.id, "client-k2@example.com");
    const project = await createProject(tenant.id, client.id, "Project");
    const service = new KinescopeService();

    await prisma.videoUploadSession.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        kinescopeVideoId: "video_456",
        fileName: "v2.mp4",
        fileType: "video/mp4",
        fileSize: 1000,
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: "video_456",
            status: "ready",
            duration_sec: 42,
            playback: { url: "https://kinescope.io/video_456" },
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await service.confirmUpload(
      { tenantId: tenant.id },
      {
        projectId: project.id,
        kinescopeVideoId: "video_456",
      },
    );

    expect(result.processingStatus).toBe(VideoProcessingStatus.READY);
    expect(result.durationSec).toBe(42);
    expect(result.streamUrl).toContain("kinescope.io");
  });

  it("updates linked versions on webhook sync", async () => {
    const tenant = await createTenant("kinescope-3");
    const user = await createUser(tenant.id, "user-k3@example.com");
    const client = await createClient(tenant.id, "client-k3@example.com");
    const project = await createProject(tenant.id, client.id, "Project");
    const service = new KinescopeService();

    await prisma.videoUploadSession.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        kinescopeVideoId: "video_789",
        fileName: "v3.mp4",
        fileType: "video/mp4",
        fileSize: 1000,
      },
    });

    const version = await prisma.assetVersion.create({
      data: {
        projectId: project.id,
        versionNo: 1,
        fileUrl: "https://kinescope.io/video_789",
        fileKey: "kinescope/video_789",
        fileName: "v3.mp4",
        fileSize: 1000,
        uploadedByUserId: user.id,
        uploadedByLegacy: user.id,
        videoProvider: VideoProvider.KINESCOPE,
        kinescopeVideoId: "video_789",
        processingStatus: VideoProcessingStatus.PROCESSING,
      },
    });

    await service.syncWebhookEvent({
      type: "video.ready",
      video: {
        id: "video_789",
        status: "ready",
        duration_sec: 61,
        playback_url: "https://kinescope.io/video_789",
      },
    });

    const updated = await prisma.assetVersion.findUnique({ where: { id: version.id } });
    expect(updated?.processingStatus).toBe(VideoProcessingStatus.READY);
    expect(updated?.durationSec).toBe(61);
  });

  it("verifies webhook signature with sha256", async () => {
    const service = new KinescopeService();
    const body = JSON.stringify({ type: "video.ready" });
    const sig = `sha256=${crypto.createHmac("sha256", "secret").update(body).digest("hex")}`;
    expect(service.verifyWebhookSignature(body, sig)).toBe(true);
    expect(service.verifyWebhookSignature(body, "sha256=bad")).toBe(false);
  });

  it("uses KINESCOPE_PROJECT_ID as fallback parent when KINESCOPE_PARENT_ID is missing", async () => {
    delete process.env.KINESCOPE_PARENT_ID;

    const tenant = await createTenant("kinescope-4");
    const client = await createClient(tenant.id, "client-k4@example.com");
    const project = await createProject(tenant.id, client.id, "Project");
    const service = new KinescopeService();

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string | undefined) ?? "{}") as Record<string, unknown>;
      expect(body.parent_id).toBe("proj_123");
      return new Response(
        JSON.stringify({
          data: {
            id: "video_999",
            endpoint: "https://uploader.kinescope.local/upload/video_999",
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await service.createUploadSession(
      { tenantId: tenant.id },
      {
        projectId: project.id,
        fileName: "v4.mp4",
        fileType: "video/mp4",
        fileSize: 1000,
      },
    );

    expect(session.kinescopeVideoId).toBe("video_999");
    expect(session.uploadMethod).toBe("POST");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries init with discovered parent_id when configured parent is invalid", async () => {
    process.env.KINESCOPE_PARENT_ID = "bad_parent";

    const tenant = await createTenant("kinescope-5");
    const client = await createClient(tenant.id, "client-k5@example.com");
    const project = await createProject(tenant.id, client.id, "Project");
    const service = new KinescopeService();

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.endsWith("/init")) {
        const body = JSON.parse((init?.body as string | undefined) ?? "{}") as Record<string, unknown>;
        if (body.parent_id === "bad_parent") {
          return new Response(
            JSON.stringify({
              error: {
                code: 400406,
                message: "parent_id invalid",
              },
            }),
            { status: 400 },
          );
        }

        expect(body.parent_id).toBe("entity_777");
        return new Response(
          JSON.stringify({
            data: {
              id: "video_retry_1",
              endpoint: "https://uploader.kinescope.local/upload/video_retry_1",
            },
          }),
          { status: 200 },
        );
      }

      if (url.endsWith("/tokens/current")) {
        return new Response(
          JSON.stringify({
            data: {
              scope: {
                upload: {
                  entities: [{ id: "entity_777" }],
                },
              },
            },
          }),
          { status: 200 },
        );
      }

      return new Response(JSON.stringify({ error: "unexpected url" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await service.createUploadSession(
      { tenantId: tenant.id },
      {
        projectId: project.id,
        fileName: "v5.mp4",
        fileType: "video/mp4",
        fileSize: 1000,
      },
    );

    expect(session.kinescopeVideoId).toBe("video_retry_1");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
