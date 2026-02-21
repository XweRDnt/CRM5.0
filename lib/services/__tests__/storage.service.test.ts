import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/utils/db";

const { signedUrlMock } = vi.hoisted(() => ({
  signedUrlMock: vi.fn(async (_client: unknown, command: unknown) => {
    const key = (command as { input?: { Key?: string } }).input?.Key ?? "";
    return `https://signed.example/${key}?X-Amz-Signature=test-signature`;
  }),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: signedUrlMock,
}));

import { StorageService } from "@/lib/services/storage.service";

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

async function cleanup() {
  await prisma.feedbackItem.deleteMany();
  await prisma.assetVersion.deleteMany();
  await prisma.project.deleteMany();
  await prisma.clientAccount.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

describe("StorageService.getUploadUrl", () => {
  let storageService: StorageService;

  beforeEach(async () => {
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_S3_BUCKET = "test-bucket";
    process.env.AWS_ACCESS_KEY_ID = "test-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret";

    await cleanup();
    signedUrlMock.mockClear();
    storageService = new StorageService();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("should generate presigned URL successfully", async () => {
    const tenant = await createTenant("agency-storage-1");
    const client = await createClient(tenant.id, "client1@test.com");
    const project = await createProject(tenant.id, client.id, "Video Project");

    const result = await storageService.getUploadUrl({
      tenantId: tenant.id,
      projectId: project.id,
      fileName: "video.mp4",
      fileType: "video/mp4",
      fileSize: 100 * 1024 * 1024,
    });

    expect(result.uploadUrl).toContain("https://signed.example/");
    expect(result.uploadUrl).toContain("X-Amz-Signature");
    expect(result.fileKey).toBeTruthy();
    expect(result.fileKey!).toContain(`tenants/${tenant.id}/projects/${project.id}/versions/`);
    expect(result.fileKey!.endsWith(".mp4")).toBe(true);
    expect(result.fileUrl).toBe(`https://test-bucket.s3.us-east-1.amazonaws.com/${result.fileKey}`);
    expect(result.expiresIn).toBe(3600);
    expect(signedUrlMock).toHaveBeenCalledTimes(1);
  });

  it("should fail if tenant does not exist", async () => {
    await expect(
      storageService.getUploadUrl({
        tenantId: "nonexistent-tenant",
        projectId: "some-project",
        fileName: "video.mp4",
        fileType: "video/mp4",
        fileSize: 1000,
      }),
    ).rejects.toThrow("Tenant not found");
  });

  it("should fail if project does not exist", async () => {
    const tenant = await createTenant("agency-storage-2");

    await expect(
      storageService.getUploadUrl({
        tenantId: tenant.id,
        projectId: "nonexistent-project",
        fileName: "video.mp4",
        fileType: "video/mp4",
        fileSize: 1000,
      }),
    ).rejects.toThrow("Project not found in this tenant");
  });

  it("should fail if project belongs to different tenant", async () => {
    const tenant1 = await createTenant("agency-s1");
    const tenant2 = await createTenant("agency-s2");
    const client1 = await createClient(tenant1.id, "client2@test.com");
    const project1 = await createProject(tenant1.id, client1.id, "Project");

    await expect(
      storageService.getUploadUrl({
        tenantId: tenant2.id,
        projectId: project1.id,
        fileName: "video.mp4",
        fileType: "video/mp4",
        fileSize: 1000,
      }),
    ).rejects.toThrow("Project not found in this tenant");
  });

  it("should fail for unsupported file type", async () => {
    const tenant = await createTenant("agency-storage-3");
    const client = await createClient(tenant.id, "client3@test.com");
    const project = await createProject(tenant.id, client.id, "Project");

    await expect(
      storageService.getUploadUrl({
        tenantId: tenant.id,
        projectId: project.id,
        fileName: "document.pdf",
        fileType: "application/pdf",
        fileSize: 1000,
      }),
    ).rejects.toThrow("File type application/pdf not supported");
  });

  it("should fail if file size exceeds 5GB", async () => {
    const tenant = await createTenant("agency-storage-4");
    const client = await createClient(tenant.id, "client4@test.com");
    const project = await createProject(tenant.id, client.id, "Project");

    await expect(
      storageService.getUploadUrl({
        tenantId: tenant.id,
        projectId: project.id,
        fileName: "huge-video.mp4",
        fileType: "video/mp4",
        fileSize: 6 * 1024 * 1024 * 1024,
      }),
    ).rejects.toThrow("File size exceeds maximum of 5GB");
  });

  it("should fail when file name is empty", async () => {
    const tenant = await createTenant("agency-storage-5");
    const client = await createClient(tenant.id, "client5@test.com");
    const project = await createProject(tenant.id, client.id, "Project");

    await expect(
      storageService.getUploadUrl({
        tenantId: tenant.id,
        projectId: project.id,
        fileName: "",
        fileType: "video/mp4",
        fileSize: 1000,
      }),
    ).rejects.toThrow("Invalid file name");
  });

  it("should fail when file name exceeds 255 characters", async () => {
    const tenant = await createTenant("agency-storage-6");
    const client = await createClient(tenant.id, "client6@test.com");
    const project = await createProject(tenant.id, client.id, "Project");

    await expect(
      storageService.getUploadUrl({
        tenantId: tenant.id,
        projectId: project.id,
        fileName: `${"a".repeat(252)}.mp4`,
        fileType: "video/mp4",
        fileSize: 1000,
      }),
    ).rejects.toThrow("Invalid file name");
  });

  it("should generate unique file keys for same filename", async () => {
    const tenant = await createTenant("agency-storage-7");
    const client = await createClient(tenant.id, "client7@test.com");
    const project = await createProject(tenant.id, client.id, "Project");

    const input = {
      tenantId: tenant.id,
      projectId: project.id,
      fileName: "video.mp4",
      fileType: "video/mp4",
      fileSize: 1000,
    };

    const result1 = await storageService.getUploadUrl(input);
    const result2 = await storageService.getUploadUrl(input);

    expect(result1.fileKey).not.toBe(result2.fileKey);
  });

  it("should preserve file extension for quicktime files", async () => {
    const tenant = await createTenant("agency-storage-8");
    const client = await createClient(tenant.id, "client8@test.com");
    const project = await createProject(tenant.id, client.id, "Project");

    const result = await storageService.getUploadUrl({
      tenantId: tenant.id,
      projectId: project.id,
      fileName: "video.mov",
      fileType: "video/quicktime",
      fileSize: 1000,
    });

    expect(result.fileKey).toBeTruthy();
    expect(result.fileKey!.endsWith(".mov")).toBe(true);
  });
});

describe("StorageService.confirmUpload", () => {
  let storageService: StorageService;

  beforeEach(async () => {
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_S3_BUCKET = "test-bucket";
    process.env.AWS_ACCESS_KEY_ID = "test-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret";

    await cleanup();
    storageService = new StorageService();
  });

  it("should confirm upload for valid file key", async () => {
    const tenant = await createTenant("agency-confirm-1");
    const fileKey = `tenants/${tenant.id}/projects/proj-123/versions/ver-123.mp4`;

    const sendSpy = vi
      .spyOn((storageService as unknown as { s3Client: { send: (command: unknown) => Promise<unknown> } }).s3Client, "send")
      .mockResolvedValue({});

    await expect(storageService.confirmUpload(fileKey, tenant.id)).resolves.toBeUndefined();

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
  });

  it("should fail if file key belongs to different tenant", async () => {
    const tenant1 = await createTenant("agency-c1");
    const tenant2 = await createTenant("agency-c2");

    const fileKey = `tenants/${tenant1.id}/projects/proj/versions/ver.mp4`;

    await expect(storageService.confirmUpload(fileKey, tenant2.id)).rejects.toThrow(
      "File key does not belong to this tenant",
    );
  });

  it("should fail if file does not exist in S3", async () => {
    const tenant = await createTenant("agency-confirm-2");
    const fileKey = `tenants/${tenant.id}/projects/proj/versions/nonexistent.mp4`;

    vi.spyOn((storageService as unknown as { s3Client: { send: (command: unknown) => Promise<unknown> } }).s3Client, "send").mockRejectedValue({
      name: "NotFound",
    });

    await expect(storageService.confirmUpload(fileKey, tenant.id)).rejects.toThrow("File not found in storage");
  });

  it("should map 404 status to file not found", async () => {
    const tenant = await createTenant("agency-confirm-3");
    const fileKey = `tenants/${tenant.id}/projects/proj/versions/nonexistent.mp4`;

    vi.spyOn((storageService as unknown as { s3Client: { send: (command: unknown) => Promise<unknown> } }).s3Client, "send").mockRejectedValue({
      name: "UnknownError",
      $metadata: { httpStatusCode: 404 },
    });

    await expect(storageService.confirmUpload(fileKey, tenant.id)).rejects.toThrow("File not found in storage");
  });

  it("should rethrow unexpected S3 errors", async () => {
    const tenant = await createTenant("agency-confirm-4");
    const fileKey = `tenants/${tenant.id}/projects/proj/versions/ver.mp4`;

    vi.spyOn((storageService as unknown as { s3Client: { send: (command: unknown) => Promise<unknown> } }).s3Client, "send").mockRejectedValue(
      new Error("S3 unavailable"),
    );

    await expect(storageService.confirmUpload(fileKey, tenant.id)).rejects.toThrow("S3 unavailable");
  });
});
