import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { AssetService } from "@/lib/services/asset.service";

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

    const input = {
      projectId: project.id,
      tenantId: tenant.id,
      fileUrl: "https://s3.amazonaws.com/file1.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project.id}/versions/file1.mp4`,
      fileName: "v1.mp4",
      fileSize: 1000,
      uploadedByUserId: user.id,
    };

    const v1 = await assetService.createVersion(input);
    const v2 = await assetService.createVersion({ ...input, fileName: "v2.mp4", fileKey: `${input.fileKey}.2` });
    const v3 = await assetService.createVersion({ ...input, fileName: "v3.mp4", fileKey: `${input.fileKey}.3` });

    expect(v1.versionNumber).toBe(1);
    expect(v2.versionNumber).toBe(2);
    expect(v3.versionNumber).toBe(3);
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
      }),
    ).rejects.toThrow("User not found in this tenant");
  });

  it("should fail if file data is incomplete", async () => {
    const tenant = await createTenant("agency-asset-7");
    const user = await createUser(tenant.id, "user6@test.com");
    const client = await createClient(tenant.id, "client6@test.com");
    const project = await createProject(tenant.id, client.id, "Project");

    await expect(
      assetService.createVersion({
        projectId: project.id,
        tenantId: tenant.id,
        fileUrl: "",
        fileKey: "key",
        fileName: "file.mp4",
        fileSize: 1000,
        uploadedByUserId: user.id,
      }),
    ).rejects.toThrow("File URL, key, and name are required");
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
      }),
    ).rejects.toThrow("File size must be greater than 0");
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

    const created = await assetService.createVersion({
      projectId: project.id,
      tenantId: tenant.id,
      fileUrl: "https://s3.amazonaws.com/file.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project.id}/versions/ver-1.mp4`,
      fileName: "file.mp4",
      fileSize: 1000,
      uploadedByUserId: user.id,
      notes: "v1",
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
    const created = await assetService.createVersion({
      projectId: project1.id,
      tenantId: tenant1.id,
      fileUrl: "https://s3.amazonaws.com/file.mp4",
      fileKey: `tenants/${tenant1.id}/projects/${project1.id}/versions/ver-1.mp4`,
      fileName: "file.mp4",
      fileSize: 1000,
      uploadedByUserId: user1.id,
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

    await assetService.createVersion({
      projectId: project.id,
      tenantId: tenant.id,
      fileUrl: "https://s3.amazonaws.com/v1.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project.id}/versions/v1.mp4`,
      fileName: "v1.mp4",
      fileSize: 1000,
      uploadedByUserId: user.id,
    });
    await assetService.createVersion({
      projectId: project.id,
      tenantId: tenant.id,
      fileUrl: "https://s3.amazonaws.com/v2.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project.id}/versions/v2.mp4`,
      fileName: "v2.mp4",
      fileSize: 1100,
      uploadedByUserId: user.id,
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

    await assetService.createVersion({
      projectId: project1.id,
      tenantId: tenant.id,
      fileUrl: "https://s3.amazonaws.com/p1.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project1.id}/versions/p1.mp4`,
      fileName: "p1.mp4",
      fileSize: 1000,
      uploadedByUserId: user.id,
    });
    await assetService.createVersion({
      projectId: project2.id,
      tenantId: tenant.id,
      fileUrl: "https://s3.amazonaws.com/p2.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project2.id}/versions/p2.mp4`,
      fileName: "p2.mp4",
      fileSize: 1000,
      uploadedByUserId: user.id,
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
    const version = await assetService.createVersion({
      projectId: project.id,
      tenantId: tenant.id,
      fileUrl: "https://s3.amazonaws.com/p1.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project.id}/versions/p1.mp4`,
      fileName: "p1.mp4",
      fileSize: 1000,
      uploadedByUserId: user.id,
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
    const version = await assetService.createVersion({
      projectId: project.id,
      tenantId: tenant.id,
      fileUrl: "https://s3.amazonaws.com/p2.mp4",
      fileKey: `tenants/${tenant.id}/projects/${project.id}/versions/p2.mp4`,
      fileName: "p2.mp4",
      fileSize: 1000,
      uploadedByUserId: user.id,
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
