import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/utils/db";
import { FeedbackService } from "@/lib/services/feedback.service";
import { FeedbackCategory, FeedbackStatus } from "@/types";
import { createTestTenant } from "@/tests/factories/tenant.factory";
import { createTestUser } from "@/tests/factories/user.factory";
import { createTestClient } from "@/tests/factories/client.factory";
import { createTestProject } from "@/tests/factories/project.factory";
import { createTestAssetVersion } from "@/tests/factories/asset.factory";

const feedbackService = new FeedbackService();

async function cleanup() {
  await prisma.scopeDecision.deleteMany();
  await prisma.feedbackItem.deleteMany();
  await prisma.assetVersion.deleteMany();
  await prisma.project.deleteMany();
  await prisma.clientAccount.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

describe("FeedbackService.createFeedback", () => {
  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("should create USER feedback with timecode", async () => {
    const tenant = await createTestTenant("agency-fb-1");
    const user = await createTestUser(tenant.id, "pm@test.com");
    const client = await createTestClient(tenant.id, "client@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);

    const result = await feedbackService.createFeedback({
      assetVersionId: version.id,
      tenantId: tenant.id,
      authorType: "USER",
      authorId: user.id,
      timecodeSec: 83,
      text: "Change logo color to blue",
      category: FeedbackCategory.DESIGN,
    });

    expect(result.id).toBeDefined();
    expect(result.assetVersionId).toBe(version.id);
    expect(result.authorType).toBe("USER");
    expect(result.author.id).toBe(user.id);
    expect(result.timecodeSec).toBe(83);
    expect(result.text).toBe("Change logo color to blue");
    expect(result.category).toBe("DESIGN");
    expect(result.status).toBe("NEW");
  });

  it("should create CLIENT feedback without timecode", async () => {
    const tenant = await createTestTenant("agency-fb-2");
    const user = await createTestUser(tenant.id, "user@test.com");
    const client = await createTestClient(tenant.id, "client@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);

    const result = await feedbackService.createFeedback({
      assetVersionId: version.id,
      tenantId: tenant.id,
      authorType: "CLIENT",
      authorEmail: "client@acme.com",
      authorName: "John Client",
      text: "Overall looks good",
    });

    expect(result.authorType).toBe("CLIENT");
    expect(result.author.name).toBe("John Client");
    expect(result.author.email).toBe("client@acme.com");
    expect(result.timecodeSec).toBeNull();
    expect(result.status).toBe("NEW");
  });

  it("should fail if asset version does not exist", async () => {
    const tenant = await createTestTenant("agency-fb-3");

    await expect(
      feedbackService.createFeedback({
        assetVersionId: "nonexistent",
        tenantId: tenant.id,
        authorType: "CLIENT",
        authorEmail: "test@test.com",
        text: "Test",
      }),
    ).rejects.toThrow("Asset version not found");
  });

  it("should fail if asset version belongs to different tenant", async () => {
    const tenant1 = await createTestTenant("agency-fb-a");
    const tenant2 = await createTestTenant("agency-fb-b");
    const user1 = await createTestUser(tenant1.id, "user-a@test.com");
    const client1 = await createTestClient(tenant1.id, "client-a@test.com");
    const project1 = await createTestProject(tenant1.id, client1.id, "Project");
    const version1 = await createTestAssetVersion(project1.id, user1.id);

    await expect(
      feedbackService.createFeedback({
        assetVersionId: version1.id,
        tenantId: tenant2.id,
        authorType: "CLIENT",
        authorEmail: "test@test.com",
        text: "Test",
      }),
    ).rejects.toThrow("Asset version not found in this tenant");
  });

  it("should fail if USER type but no authorId", async () => {
    const tenant = await createTestTenant("agency-fb-4");
    const user = await createTestUser(tenant.id, "user4@test.com");
    const client = await createTestClient(tenant.id, "client4@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);

    await expect(
      feedbackService.createFeedback({
        assetVersionId: version.id,
        tenantId: tenant.id,
        authorType: "USER",
        text: "Test",
      }),
    ).rejects.toThrow("authorId is required for USER type feedback");
  });

  it("should fail if USER author does not exist in tenant", async () => {
    const tenant = await createTestTenant("agency-fb-4b");
    const user = await createTestUser(tenant.id, "user4b@test.com");
    const client = await createTestClient(tenant.id, "client4b@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);

    await expect(
      feedbackService.createFeedback({
        assetVersionId: version.id,
        tenantId: tenant.id,
        authorType: "USER",
        authorId: "missing-user",
        text: "Test",
      }),
    ).rejects.toThrow("User not found in this tenant");
  });

  it("should fail if CLIENT type but no email/name", async () => {
    const tenant = await createTestTenant("agency-fb-5");
    const user = await createTestUser(tenant.id, "user5@test.com");
    const client = await createTestClient(tenant.id, "client5@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);

    await expect(
      feedbackService.createFeedback({
        assetVersionId: version.id,
        tenantId: tenant.id,
        authorType: "CLIENT",
        text: "Test",
      }),
    ).rejects.toThrow("authorEmail or authorName is required for CLIENT type feedback");
  });

  it("should fail if text is too long", async () => {
    const tenant = await createTestTenant("agency-fb-6");
    const user = await createTestUser(tenant.id, "user6@test.com");
    const client = await createTestClient(tenant.id, "client6@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);

    await expect(
      feedbackService.createFeedback({
        assetVersionId: version.id,
        tenantId: tenant.id,
        authorType: "CLIENT",
        authorEmail: "test@test.com",
        text: "a".repeat(5001),
      }),
    ).rejects.toThrow("must be under 5000 characters");
  });

  it("should fail if text is empty", async () => {
    const tenant = await createTestTenant("agency-fb-6b");
    const user = await createTestUser(tenant.id, "user6b@test.com");
    const client = await createTestClient(tenant.id, "client6b@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);

    await expect(
      feedbackService.createFeedback({
        assetVersionId: version.id,
        tenantId: tenant.id,
        authorType: "CLIENT",
        authorEmail: "test@test.com",
        text: "   ",
      }),
    ).rejects.toThrow("Feedback text is required");
  });

  it("should fail if timecode is negative", async () => {
    const tenant = await createTestTenant("agency-fb-7");
    const user = await createTestUser(tenant.id, "user7@test.com");
    const client = await createTestClient(tenant.id, "client7@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);

    await expect(
      feedbackService.createFeedback({
        assetVersionId: version.id,
        tenantId: tenant.id,
        authorType: "CLIENT",
        authorEmail: "test@test.com",
        timecodeSec: -10,
        text: "Test",
      }),
    ).rejects.toThrow("Timecode must be non-negative");
  });
});

describe("FeedbackService.getFeedbackById", () => {
  beforeEach(async () => {
    await cleanup();
  });

  it("should return feedback by id", async () => {
    const tenant = await createTestTenant("agency-fb-8");
    const user = await createTestUser(tenant.id, "user8@test.com", "Jane", "PM");
    const client = await createTestClient(tenant.id, "client8@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);
    const created = await feedbackService.createFeedback({
      assetVersionId: version.id,
      tenantId: tenant.id,
      authorType: "USER",
      authorId: user.id,
      text: "Fix transition",
    });

    const result = await feedbackService.getFeedbackById(created.id, tenant.id);

    expect(result.id).toBe(created.id);
    expect(result.author.name).toBe("Jane PM");
    expect(result.text).toBe("Fix transition");
  });

  it("should fail if feedback does not exist", async () => {
    const tenant = await createTestTenant("agency-fb-9");
    await expect(feedbackService.getFeedbackById("missing", tenant.id)).rejects.toThrow("Feedback not found");
  });

  it("should fail if feedback belongs to different tenant", async () => {
    const tenant1 = await createTestTenant("agency-fb-10a");
    const tenant2 = await createTestTenant("agency-fb-10b");
    const user = await createTestUser(tenant1.id, "user10@test.com");
    const client = await createTestClient(tenant1.id, "client10@test.com");
    const project = await createTestProject(tenant1.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);
    const created = await feedbackService.createFeedback({
      assetVersionId: version.id,
      tenantId: tenant1.id,
      authorType: "CLIENT",
      authorEmail: "x@test.com",
      text: "Needs changes",
    });

    await expect(feedbackService.getFeedbackById(created.id, tenant2.id)).rejects.toThrow("Feedback not found");
  });

  it("should map anonymous author as Anonymous", async () => {
    const tenant = await createTestTenant("agency-fb-11");
    const user = await createTestUser(tenant.id, "user11@test.com");
    const client = await createTestClient(tenant.id, "client11@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);

    const created = await feedbackService.createFeedback({
      assetVersionId: version.id,
      tenantId: tenant.id,
      authorType: "CLIENT",
      authorEmail: "anon@test.com",
      text: "Looks good",
    });

    const result = await feedbackService.getFeedbackById(created.id, tenant.id);
    expect(result.author.name).toBe("Anonymous");
    expect(result.author.email).toBe("anon@test.com");
  });
});

describe("FeedbackService.listFeedbackByVersion", () => {
  beforeEach(async () => {
    await cleanup();
  });

  it("should list all feedback for version sorted by createdAt ASC", async () => {
    const tenant = await createTestTenant("agency-fb-12");
    const user = await createTestUser(tenant.id, "user12@test.com");
    const client = await createTestClient(tenant.id, "client12@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);

    await feedbackService.createFeedback({
      assetVersionId: version.id,
      tenantId: tenant.id,
      authorType: "CLIENT",
      authorEmail: "first@test.com",
      text: "First",
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await feedbackService.createFeedback({
      assetVersionId: version.id,
      tenantId: tenant.id,
      authorType: "CLIENT",
      authorEmail: "second@test.com",
      text: "Second",
    });

    const result = await feedbackService.listFeedbackByVersion(version.id, tenant.id);
    expect(result.length).toBe(2);
    expect(result[0].text).toBe("First");
    expect(result[1].text).toBe("Second");
  });

  it("should return empty array when version has no feedback", async () => {
    const tenant = await createTestTenant("agency-fb-13");
    const user = await createTestUser(tenant.id, "user13@test.com");
    const client = await createTestClient(tenant.id, "client13@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);

    const result = await feedbackService.listFeedbackByVersion(version.id, tenant.id);
    expect(result).toEqual([]);
  });

  it("should fail when version not found in tenant", async () => {
    const tenant = await createTestTenant("agency-fb-14");
    await expect(feedbackService.listFeedbackByVersion("missing-version", tenant.id)).rejects.toThrow(
      "Asset version not found in this tenant",
    );
  });

  it("should fail when version belongs to another tenant", async () => {
    const tenant1 = await createTestTenant("agency-fb-15a");
    const tenant2 = await createTestTenant("agency-fb-15b");
    const user = await createTestUser(tenant1.id, "user15@test.com");
    const client = await createTestClient(tenant1.id, "client15@test.com");
    const project = await createTestProject(tenant1.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);

    await expect(feedbackService.listFeedbackByVersion(version.id, tenant2.id)).rejects.toThrow(
      "Asset version not found in this tenant",
    );
  });
});

describe("FeedbackService.listFeedbackByProject", () => {
  beforeEach(async () => {
    await cleanup();
  });

  it("should list all feedback for project sorted by createdAt DESC", async () => {
    const tenant = await createTestTenant("agency-fb-16");
    const user = await createTestUser(tenant.id, "user16@test.com");
    const client = await createTestClient(tenant.id, "client16@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");
    const version1 = await createTestAssetVersion(project.id, user.id, { fileName: "v1.mp4", versionNo: 1 });
    const version2 = await createTestAssetVersion(project.id, user.id, { fileName: "v2.mp4", versionNo: 2 });

    await feedbackService.createFeedback({
      assetVersionId: version1.id,
      tenantId: tenant.id,
      authorType: "CLIENT",
      authorEmail: "first@test.com",
      text: "Older comment",
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await feedbackService.createFeedback({
      assetVersionId: version2.id,
      tenantId: tenant.id,
      authorType: "CLIENT",
      authorEmail: "second@test.com",
      text: "Newer comment",
    });

    const result = await feedbackService.listFeedbackByProject(project.id, tenant.id);
    expect(result.length).toBe(2);
    expect(result[0].text).toBe("Newer comment");
    expect(result[1].text).toBe("Older comment");
  });

  it("should return empty array when project has no feedback", async () => {
    const tenant = await createTestTenant("agency-fb-17");
    const user = await createTestUser(tenant.id, "user17@test.com");
    const client = await createTestClient(tenant.id, "client17@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");
    await createTestAssetVersion(project.id, user.id);

    const result = await feedbackService.listFeedbackByProject(project.id, tenant.id);
    expect(result).toEqual([]);
  });

  it("should fail when project does not exist in tenant", async () => {
    const tenant = await createTestTenant("agency-fb-18");
    await expect(feedbackService.listFeedbackByProject("missing-project", tenant.id)).rejects.toThrow(
      "Project not found in this tenant",
    );
  });

  it("should fail when project belongs to another tenant", async () => {
    const tenant1 = await createTestTenant("agency-fb-19a");
    const tenant2 = await createTestTenant("agency-fb-19b");
    const user = await createTestUser(tenant1.id, "user19@test.com");
    const client = await createTestClient(tenant1.id, "client19@test.com");
    const project = await createTestProject(tenant1.id, client.id, "Project");
    await createTestAssetVersion(project.id, user.id);

    await expect(feedbackService.listFeedbackByProject(project.id, tenant2.id)).rejects.toThrow(
      "Project not found in this tenant",
    );
  });
});

describe("FeedbackService.updateFeedbackStatus", () => {
  beforeEach(async () => {
    await cleanup();
  });

  it("should update feedback status", async () => {
    const tenant = await createTestTenant("agency-fb-20");
    const user = await createTestUser(tenant.id, "user20@test.com");
    const client = await createTestClient(tenant.id, "client20@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);
    const created = await feedbackService.createFeedback({
      assetVersionId: version.id,
      tenantId: tenant.id,
      authorType: "CLIENT",
      authorEmail: "client20@ext.com",
      text: "Will be updated",
    });

    const updated = await feedbackService.updateFeedbackStatus({
      feedbackId: created.id,
      tenantId: tenant.id,
      status: FeedbackStatus.RESOLVED,
    });

    expect(updated.status).toBe("RESOLVED");
  });

  it("should fail when feedback does not exist", async () => {
    const tenant = await createTestTenant("agency-fb-21");
    await expect(
      feedbackService.updateFeedbackStatus({
        feedbackId: "missing-feedback",
        tenantId: tenant.id,
        status: FeedbackStatus.IN_PROGRESS,
      }),
    ).rejects.toThrow("Feedback not found");
  });

  it("should fail when feedback belongs to another tenant", async () => {
    const tenant1 = await createTestTenant("agency-fb-22a");
    const tenant2 = await createTestTenant("agency-fb-22b");
    const user = await createTestUser(tenant1.id, "user22@test.com");
    const client = await createTestClient(tenant1.id, "client22@test.com");
    const project = await createTestProject(tenant1.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);
    const created = await feedbackService.createFeedback({
      assetVersionId: version.id,
      tenantId: tenant1.id,
      authorType: "CLIENT",
      authorEmail: "client22@ext.com",
      text: "Cross-tenant update",
    });

    await expect(
      feedbackService.updateFeedbackStatus({
        feedbackId: created.id,
        tenantId: tenant2.id,
        status: FeedbackStatus.REJECTED,
      }),
    ).rejects.toThrow("Feedback not found");
  });

  it("should only update status and keep other fields", async () => {
    const tenant = await createTestTenant("agency-fb-23");
    const user = await createTestUser(tenant.id, "user23@test.com");
    const client = await createTestClient(tenant.id, "client23@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);
    const created = await feedbackService.createFeedback({
      assetVersionId: version.id,
      tenantId: tenant.id,
      authorType: "CLIENT",
      authorEmail: "client23@ext.com",
      text: "Keep this text",
      category: FeedbackCategory.SOUND,
      timecodeSec: 45,
    });

    const updated = await feedbackService.updateFeedbackStatus({
      feedbackId: created.id,
      tenantId: tenant.id,
      status: FeedbackStatus.IN_PROGRESS,
    });

    expect(updated.status).toBe("IN_PROGRESS");
    expect(updated.text).toBe("Keep this text");
    expect(updated.category).toBe("SOUND");
    expect(updated.timecodeSec).toBe(45);
  });
});

describe("FeedbackService.deleteFeedback", () => {
  beforeEach(async () => {
    await cleanup();
  });

  it("should delete feedback", async () => {
    const tenant = await createTestTenant("agency-fb-24");
    const user = await createTestUser(tenant.id, "user24@test.com");
    const client = await createTestClient(tenant.id, "client24@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);
    const created = await feedbackService.createFeedback({
      assetVersionId: version.id,
      tenantId: tenant.id,
      authorType: "CLIENT",
      authorEmail: "client24@ext.com",
      text: "To be deleted",
    });

    await feedbackService.deleteFeedback(created.id, tenant.id);

    const exists = await prisma.feedbackItem.findUnique({ where: { id: created.id } });
    expect(exists).toBeNull();
  });

  it("should fail deleting feedback from another tenant", async () => {
    const tenant1 = await createTestTenant("agency-fb-25a");
    const tenant2 = await createTestTenant("agency-fb-25b");
    const user = await createTestUser(tenant1.id, "user25@test.com");
    const client = await createTestClient(tenant1.id, "client25@test.com");
    const project = await createTestProject(tenant1.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);
    const created = await feedbackService.createFeedback({
      assetVersionId: version.id,
      tenantId: tenant1.id,
      authorType: "CLIENT",
      authorEmail: "client25@ext.com",
      text: "Wrong tenant delete",
    });

    await expect(feedbackService.deleteFeedback(created.id, tenant2.id)).rejects.toThrow("Feedback not found");
  });

  it("should fail deleting non-existent feedback", async () => {
    const tenant = await createTestTenant("agency-fb-26");
    await expect(feedbackService.deleteFeedback("missing-feedback", tenant.id)).rejects.toThrow("Feedback not found");
  });
});
