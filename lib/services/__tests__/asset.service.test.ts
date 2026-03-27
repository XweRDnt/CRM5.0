import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole, VideoProvider } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { AssetService, VersionConflictError } from "@/lib/services/asset.service";

const deleteVideoMock = vi.fn();

vi.mock("@/lib/services/kinescope.service", () => ({
  getKinescopeService: () => ({
    deleteVideo: deleteVideoMock,
  }),
}));

async function createTenant(slugPrefix: string) {
  return prisma.tenant.create({
    data: {
      name: `Tenant ${slugPrefix}`,
      slug: `${slugPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
  });
}

async function createUser(tenantId: string, email: string, firstName = "Test", lastName = "User") {
  return prisma.user.create({
    data: {
      tenantId,
      role: UserRole.PM,
      firstName,
      lastName,
      email,
    },
  });
}

async function createClient(tenantId: string, email: string) {
  return { id: `client-${tenantId}-${email}` };
}

async function createProject(tenantId: string, clientAccountId: string, name: string) {
  return prisma.project.create({
    data: {
      tenantId,
      name,
      portalToken: `portal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
  });
}

async function createUploadSession(tenantId: string, projectId: string, kinescopeVideoId: string, fileName: string) {
  return prisma.videoUploadSession.create({
    data: {
      tenantId,
      projectId,
      kinescopeVideoId,
      fileName,
      fileType: "video/mp4",
      fileSize: 1_000_000,
    },
  });
}

async function cleanup() {
  await prisma.feedbackItem.deleteMany();
  await prisma.assetVersion.deleteMany();
  await prisma.videoUploadSession.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

describe("AssetService.createVersion", () => {
  let assetService: AssetService;

  beforeEach(async () => {
    await cleanup();
    assetService = new AssetService();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("should create first version with number 1", async () => {
    const tenant = await createTenant("agency-asset-1");
    const user = await createUser(tenant.id, "user1@test.com");
    const client = await createClient(tenant.id, "client1@test.com");
    const project = await createProject(tenant.id, client.id, "Project");
    const kinescopeVideoId = "video_asset_1";

    await createUploadSession(tenant.id, project.id, kinescopeVideoId, "video.mp4");

    const result = await assetService.createVersion({
      projectId: project.id,
      tenantId: tenant.id,
      fileUrl: "https://s3.amazonaws.com/bucket/file.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project.id}/versions/ver-1.mp4`,
      fileName: "video.mp4",
      fileSize: 10_000_000,
      durationSec: 120,
      uploadedByUserId: user.id,
      notes: "First version",
      kinescopeVideoId,
    });

    expect(result.versionNumber).toBe(1);
    expect(result.fileName).toBe("video.mp4");
    expect(result.uploadedBy.id).toBe(user.id);
    expect(result.durationSec).toBe(120);
    expect(result.notes).toBe("First version");
  });

  it("should auto-increment version number", async () => {
    const tenant = await createTenant("agency-asset-2");
    const user = await createUser(tenant.id, "user2@test.com");
    const client = await createClient(tenant.id, "client2@test.com");
    const project = await createProject(tenant.id, client.id, "Project");
    const kinescopeVideoId = "video_asset_2";

    await createUploadSession(tenant.id, project.id, kinescopeVideoId, "v1.mp4");

    const input = {
      projectId: project.id,
      tenantId: tenant.id,
      fileUrl: "https://s3.amazonaws.com/file1.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project.id}/versions/file1.mp4`,
      fileName: "v1.mp4",
      fileSize: 1000,
      uploadedByUserId: user.id,
      kinescopeVideoId,
    };

    const v1 = await assetService.createVersion(input);
    const v2 = await assetService.createVersion({ ...input, fileName: "v2.mp4", fileKey: `${input.fileKey}.2` });
    const v3 = await assetService.createVersion({ ...input, fileName: "v3.mp4", fileKey: `${input.fileKey}.3` });

    expect(v1.versionNumber).toBe(1);
    expect(v2.versionNumber).toBe(2);
    expect(v3.versionNumber).toBe(3);
  });

  it("should return conflict with suggested next version", async () => {
    const tenant = await createTenant("agency-asset-conflict");
    const user = await createUser(tenant.id, "user-conflict@test.com");
    const client = await createClient(tenant.id, "client-conflict@test.com");
    const project = await createProject(tenant.id, client.id, "Project");
    const kinescopeVideoId = "video_asset_conflict";

    await createUploadSession(tenant.id, project.id, kinescopeVideoId, "v1.mp4");

    await assetService.createVersion({
      projectId: project.id,
      tenantId: tenant.id,
      versionNo: 1,
      fileUrl: "https://s3.amazonaws.com/v1.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project.id}/versions/v1.mp4`,
      fileName: "v1.mp4",
      fileSize: 1000,
      uploadedByUserId: user.id,
      kinescopeVideoId,
    });

    try {
      await assetService.createVersion({
        projectId: project.id,
        tenantId: tenant.id,
        versionNo: 1,
        fileUrl: "https://s3.amazonaws.com/v1-duplicate.mp4",
        fileKey: `tenants/${tenant.id}/projects/${project.id}/versions/v1-duplicate.mp4`,
        fileName: "v1-duplicate.mp4",
        fileSize: 1000,
        uploadedByUserId: user.id,
        kinescopeVideoId,
      });
      throw new Error("Expected conflict error");
    } catch (error) {
      expect(error).toBeInstanceOf(VersionConflictError);
      expect((error as VersionConflictError).suggestedVersionNo).toBe(2);
    }
  });

  it("should fail if project does not exist", async () => {
    const tenant = await createTenant("agency-asset-3");
    const user = await createUser(tenant.id, "user3@test.com");

    await expect(
      assetService.createVersion({
        projectId: "nonexistent",
        tenantId: tenant.id,
        fileUrl: "url",
        fileKey: "key",
        fileName: "file.mp4",
        fileSize: 1000,
        uploadedByUserId: user.id,
        kinescopeVideoId: "video_asset_missing_project",
      }),
    ).rejects.toThrow("Project not found in this tenant");
  });

  it("should fail if project belongs to different tenant", async () => {
    const tenant1 = await createTenant("agency-a1");
    const tenant2 = await createTenant("agency-a2");
    const user1 = await createUser(tenant1.id, "user4@test.com");
    const client1 = await createClient(tenant1.id, "client3@test.com");
    const project1 = await createProject(tenant1.id, client1.id, "Project");

    await expect(
      assetService.createVersion({
        projectId: project1.id,
        tenantId: tenant2.id,
        fileUrl: "url",
        fileKey: "key",
        fileName: "file.mp4",
        fileSize: 1000,
        uploadedByUserId: user1.id,
        kinescopeVideoId: "video_asset_wrong_tenant",
      }),
    ).rejects.toThrow("Project not found in this tenant");
  });

  it("should fail if user does not exist", async () => {
    const tenant = await createTenant("agency-asset-4");
    const client = await createClient(tenant.id, "client4@test.com");
    const project = await createProject(tenant.id, client.id, "Project");

    await expect(
      assetService.createVersion({
        projectId: project.id,
        tenantId: tenant.id,
        fileUrl: "url",
        fileKey: "key",
        fileName: "file.mp4",
        fileSize: 1000,
        uploadedByUserId: "nonexistent-user",
        kinescopeVideoId: "video_asset_missing_user",
      }),
    ).rejects.toThrow("User not found in this tenant");
  });

  it("should fail if user belongs to different tenant", async () => {
    const tenant1 = await createTenant("agency-asset-5");
    const tenant2 = await createTenant("agency-asset-6");
    const user1 = await createUser(tenant1.id, "user5@test.com");
    const client2 = await createClient(tenant2.id, "client5@test.com");
    const project2 = await createProject(tenant2.id, client2.id, "Project 2");

    await expect(
      assetService.createVersion({
        projectId: project2.id,
        tenantId: tenant2.id,
        fileUrl: "url",
        fileKey: "key",
        fileName: "file.mp4",
        fileSize: 1000,
        uploadedByUserId: user1.id,
        kinescopeVideoId: "video_asset_wrong_user_tenant",
      }),
    ).rejects.toThrow("User not found in this tenant");
  });

  it("should fail if kinescopeVideoId is missing", async () => {
    const tenant = await createTenant("agency-asset-7");
    const user = await createUser(tenant.id, "user6@test.com");
    const client = await createClient(tenant.id, "client6@test.com");
    const project = await createProject(tenant.id, client.id, "Project");

    await expect(
      assetService.createVersion({
        projectId: project.id,
        tenantId: tenant.id,
        fileKey: "key",
        fileName: "file.mp4",
        fileSize: 1000,
        uploadedByUserId: user.id,
      }),
    ).rejects.toThrow("kinescopeVideoId is required");
  });

  it("should fail if fileSize is not positive", async () => {
    const tenant = await createTenant("agency-asset-8");
    const user = await createUser(tenant.id, "user7@test.com");
    const client = await createClient(tenant.id, "client7@test.com");
    const project = await createProject(tenant.id, client.id, "Project");

    await expect(
      assetService.createVersion({
        projectId: project.id,
        tenantId: tenant.id,
        fileUrl: "https://x",
        fileKey: "key",
        fileName: "file.mp4",
        fileSize: 0,
        uploadedByUserId: user.id,
        kinescopeVideoId: "video_asset_invalid_size",
      }),
    ).rejects.toThrow("File size must be greater than 0");
  });
});

describe("AssetService.getVersionMeta", () => {
  let assetService: AssetService;

  beforeEach(async () => {
    await cleanup();
    assetService = new AssetService();
  });

  it("should return next version for empty project", async () => {
    const tenant = await createTenant("agency-asset-meta-empty");
    const client = await createClient(tenant.id, "client-meta-empty@test.com");
    const project = await createProject(tenant.id, client.id, "Project");

    const meta = await assetService.getVersionMeta(project.id, tenant.id);

    expect(meta.usedVersionNumbers).toEqual([]);
    expect(meta.nextVersionNumber).toBe(1);
  });

  it("should return used versions and next number", async () => {
    const tenant = await createTenant("agency-asset-meta");
    const user = await createUser(tenant.id, "user-meta@test.com");
    const client = await createClient(tenant.id, "client-meta@test.com");
    const project = await createProject(tenant.id, client.id, "Project");
    const kinescopeVideoId = "video_asset_meta";

    await createUploadSession(tenant.id, project.id, kinescopeVideoId, "v1.mp4");

    await assetService.createVersion({
      projectId: project.id,
      tenantId: tenant.id,
      versionNo: 1,
      fileUrl: "https://s3.amazonaws.com/v1.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project.id}/versions/v1.mp4`,
      fileName: "v1.mp4",
      fileSize: 1000,
      uploadedByUserId: user.id,
      kinescopeVideoId,
    });
    await assetService.createVersion({
      projectId: project.id,
      tenantId: tenant.id,
      versionNo: 2,
      fileUrl: "https://s3.amazonaws.com/v2.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project.id}/versions/v2.mp4`,
      fileName: "v2.mp4",
      fileSize: 1000,
      uploadedByUserId: user.id,
      kinescopeVideoId,
    });

    const meta = await assetService.getVersionMeta(project.id, tenant.id);

    expect(meta.usedVersionNumbers).toEqual([1, 2]);
    expect(meta.nextVersionNumber).toBe(3);
  });
});

describe("AssetService.getVersionById", () => {
  let assetService: AssetService;

  beforeEach(async () => {
    await cleanup();
    assetService = new AssetService();
  });

  it("should return version with uploadedBy data", async () => {
    const tenant = await createTenant("agency-asset-9");
    const user = await createUser(tenant.id, "user8@test.com", "Jane", "Editor");
    const client = await createClient(tenant.id, "client8@test.com");
    const project = await createProject(tenant.id, client.id, "Project");
    const kinescopeVideoId = "video_asset_get_1";

    await createUploadSession(tenant.id, project.id, kinescopeVideoId, "file.mp4");

    const created = await assetService.createVersion({
      projectId: project.id,
      tenantId: tenant.id,
      fileUrl: "https://s3.amazonaws.com/file.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project.id}/versions/ver-1.mp4`,
      fileName: "file.mp4",
      fileSize: 1000,
      uploadedByUserId: user.id,
      notes: "v1",
      kinescopeVideoId,
    });

    const result = await assetService.getVersionById(created.id, tenant.id);

    expect(result.id).toBe(created.id);
    expect(result.uploadedBy.id).toBe(user.id);
    expect(result.uploadedBy.name).toBe("Jane Editor");
    expect(result.versionNumber).toBe(1);
  });

  it("should fail when version does not exist", async () => {
    const tenant = await createTenant("agency-asset-10");

    await expect(assetService.getVersionById("missing-version", tenant.id)).rejects.toThrow("Asset version not found");
  });

  it("should fail when version exists in different tenant", async () => {
    const tenant1 = await createTenant("agency-asset-11");
    const tenant2 = await createTenant("agency-asset-12");
    const user1 = await createUser(tenant1.id, "user9@test.com");
    const client1 = await createClient(tenant1.id, "client9@test.com");
    const project1 = await createProject(tenant1.id, client1.id, "Project");
    const kinescopeVideoId = "video_asset_get_2";

    await createUploadSession(tenant1.id, project1.id, kinescopeVideoId, "file.mp4");
    const created = await assetService.createVersion({
      projectId: project1.id,
      tenantId: tenant1.id,
      fileUrl: "https://s3.amazonaws.com/file.mp4",
      fileKey: `tenants/${tenant1.id}/projects/${project1.id}/versions/ver-1.mp4`,
      fileName: "file.mp4",
      fileSize: 1000,
      uploadedByUserId: user1.id,
      kinescopeVideoId,
    });

    await expect(assetService.getVersionById(created.id, tenant2.id)).rejects.toThrow("Asset version not found");
  });
});

describe("AssetService.listVersionsByProject", () => {
  let assetService: AssetService;

  beforeEach(async () => {
    await cleanup();
    assetService = new AssetService();
  });

  it("should list versions sorted by versionNumber desc", async () => {
    const tenant = await createTenant("agency-asset-13");
    const user = await createUser(tenant.id, "user10@test.com");
    const client = await createClient(tenant.id, "client10@test.com");
    const project = await createProject(tenant.id, client.id, "Project");
    const kinescopeVideoId = "video_asset_list_1";

    await createUploadSession(tenant.id, project.id, kinescopeVideoId, "v1.mp4");

    await assetService.createVersion({
      projectId: project.id,
      tenantId: tenant.id,
      fileUrl: "https://s3.amazonaws.com/v1.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project.id}/versions/v1.mp4`,
      fileName: "v1.mp4",
      fileSize: 1000,
      uploadedByUserId: user.id,
      kinescopeVideoId,
    });
    await assetService.createVersion({
      projectId: project.id,
      tenantId: tenant.id,
      fileUrl: "https://s3.amazonaws.com/v2.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project.id}/versions/v2.mp4`,
      fileName: "v2.mp4",
      fileSize: 1100,
      uploadedByUserId: user.id,
      kinescopeVideoId,
    });

    const result = await assetService.listVersionsByProject(project.id, tenant.id);

    expect(result.length).toBe(2);
    expect(result[0].versionNumber).toBe(2);
    expect(result[1].versionNumber).toBe(1);
  });

  it("should return empty array when project has no versions", async () => {
    const tenant = await createTenant("agency-asset-14");
    const client = await createClient(tenant.id, "client11@test.com");
    const project = await createProject(tenant.id, client.id, "Project");

    const result = await assetService.listVersionsByProject(project.id, tenant.id);

    expect(result).toEqual([]);
  });

  it("should fail when project belongs to another tenant", async () => {
    const tenant1 = await createTenant("agency-asset-15");
    const tenant2 = await createTenant("agency-asset-16");
    const client1 = await createClient(tenant1.id, "client12@test.com");
    const project1 = await createProject(tenant1.id, client1.id, "Project");

    await expect(assetService.listVersionsByProject(project1.id, tenant2.id)).rejects.toThrow(
      "Project not found in this tenant",
    );
  });

  it("should only return versions for requested project", async () => {
    const tenant = await createTenant("agency-asset-17");
    const user = await createUser(tenant.id, "user11@test.com");
    const client = await createClient(tenant.id, "client13@test.com");
    const project1 = await createProject(tenant.id, client.id, "Project 1");
    const project2 = await createProject(tenant.id, client.id, "Project 2");
    const kinescopeVideoId1 = "video_asset_list_2";
    const kinescopeVideoId2 = "video_asset_list_3";

    await createUploadSession(tenant.id, project1.id, kinescopeVideoId1, "p1.mp4");
    await createUploadSession(tenant.id, project2.id, kinescopeVideoId2, "p2.mp4");

    await assetService.createVersion({
      projectId: project1.id,
      tenantId: tenant.id,
      fileUrl: "https://s3.amazonaws.com/p1.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project1.id}/versions/p1.mp4`,
      fileName: "p1.mp4",
      fileSize: 1000,
      uploadedByUserId: user.id,
      kinescopeVideoId: kinescopeVideoId1,
    });
    await assetService.createVersion({
      projectId: project2.id,
      tenantId: tenant.id,
      fileUrl: "https://s3.amazonaws.com/p2.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project2.id}/versions/p2.mp4`,
      fileName: "p2.mp4",
      fileSize: 1000,
      uploadedByUserId: user.id,
      kinescopeVideoId: kinescopeVideoId2,
    });

    const result = await assetService.listVersionsByProject(project1.id, tenant.id);

    expect(result.length).toBe(1);
    expect(result[0].fileName).toBe("p1.mp4");
  });
});

describe("AssetService.approveVersion", () => {
  let assetService: AssetService;

  beforeEach(async () => {
    await cleanup();
    assetService = new AssetService();
  });

  it("should approve version directly from DRAFT", async () => {
    const tenant = await createTenant("agency-asset-18");
    const user = await createUser(tenant.id, "user12@test.com");
    const client = await createClient(tenant.id, "client14@test.com");
    const project = await createProject(tenant.id, client.id, "Project");
    const kinescopeVideoId = "video_asset_approve_1";

    await createUploadSession(tenant.id, project.id, kinescopeVideoId, "p1.mp4");
    const version = await assetService.createVersion({
      projectId: project.id,
      tenantId: tenant.id,
      fileUrl: "https://s3.amazonaws.com/p1.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project.id}/versions/p1.mp4`,
      fileName: "p1.mp4",
      fileSize: 1000,
      uploadedByUserId: user.id,
      kinescopeVideoId,
    });

    const approved = await assetService.approveVersion({
      projectId: project.id,
      versionId: version.id,
      tenantId: tenant.id,
      approvedBy: user.id,
    });

    expect(approved.status).toBe("APPROVED");
    expect(approved.approvedBy).toBe(user.id);
    expect(approved.approvedAt).toBeTruthy();
  });

  it("should keep approval idempotent for already approved version", async () => {
    const tenant = await createTenant("agency-asset-19");
    const user = await createUser(tenant.id, "user13@test.com");
    const client = await createClient(tenant.id, "client15@test.com");
    const project = await createProject(tenant.id, client.id, "Project");
    const kinescopeVideoId = "video_asset_approve_2";

    await createUploadSession(tenant.id, project.id, kinescopeVideoId, "p2.mp4");
    const version = await assetService.createVersion({
      projectId: project.id,
      tenantId: tenant.id,
      fileUrl: "https://s3.amazonaws.com/p2.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project.id}/versions/p2.mp4`,
      fileName: "p2.mp4",
      fileSize: 1000,
      uploadedByUserId: user.id,
      kinescopeVideoId,
    });

    const firstApprove = await assetService.approveVersion({
      projectId: project.id,
      versionId: version.id,
      tenantId: tenant.id,
      approvedBy: user.id,
    });

    const secondApprove = await assetService.approveVersion({
      projectId: project.id,
      versionId: version.id,
      tenantId: tenant.id,
      approvedBy: user.id,
    });

    expect(secondApprove.status).toBe("APPROVED");
    expect(secondApprove.approvedAt?.toISOString()).toBe(firstApprove.approvedAt?.toISOString());
  });
});

describe("AssetService.deleteVersion", () => {
  let assetService: AssetService;

  beforeEach(async () => {
    await cleanup();
    deleteVideoMock.mockReset();
    assetService = new AssetService();
  });

  it("deletes kinescope video before removing version", async () => {
    const tenant = await createTenant("agency-asset-delete-1");
    const user = await createUser(tenant.id, "user-delete@test.com");
    const client = await createClient(tenant.id, "client-delete@test.com");
    const project = await createProject(tenant.id, client.id, "Project");

    const version = await prisma.assetVersion.create({
      data: {
        projectId: project.id,
        versionNo: 1,
        fileUrl: "https://kinescope.io/video_del_1",
        fileKey: "kinescope/video_del_1",
        fileName: "v1.mp4",
        fileSize: 1000,
        uploadedByUserId: user.id,
        uploadedByLegacy: user.id,
        videoProvider: VideoProvider.KINESCOPE,
        kinescopeVideoId: "video_del_1",
      },
    });

    deleteVideoMock.mockResolvedValue(undefined);

    await assetService.deleteVersion(
      { tenantId: tenant.id, userId: user.id, role: UserRole.PM },
      { projectId: project.id, versionId: version.id },
    );

    expect(deleteVideoMock).toHaveBeenCalledWith("video_del_1");
    const remaining = await prisma.assetVersion.findUnique({ where: { id: version.id } });
    expect(remaining).toBeNull();
  });

});
