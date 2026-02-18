import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationService } from "@/lib/services/notification.service";
import { prisma } from "@/lib/utils/db";
import { createTestAssetVersion } from "@/tests/factories/asset.factory";
import { createTestClient } from "@/tests/factories/client.factory";
import { createTestFeedback } from "@/tests/factories/feedback.factory";
import { createTestProject } from "@/tests/factories/project.factory";
import { createTestTenant } from "@/tests/factories/tenant.factory";
import { createTestUser } from "@/tests/factories/user.factory";

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function ResendMock() {
    return {
      emails: {
        send: mockSend,
      },
    };
  }),
}));

let notificationService: NotificationService;

async function cleanup() {
  await prisma.notification.deleteMany();
  await prisma.workflowStage.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.aITask.deleteMany();
  await prisma.scopeDecision.deleteMany();
  await prisma.feedbackItem.deleteMany();
  await prisma.assetVersion.deleteMany();
  await prisma.project.deleteMany();
  await prisma.clientAccount.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

describe("NotificationService.sendEmail", () => {
  beforeEach(async () => {
    await cleanup();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.NOTIFICATION_FROM_EMAIL = "noreply@test.local";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    mockSend.mockReset();
    mockSend.mockResolvedValue({ id: "mock-email-id" });
    notificationService = new NotificationService(prisma as PrismaClient);
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("should send email successfully", async () => {
    const tenant = await createTestTenant("agency-notify-send-1");

    const result = await notificationService.sendEmail({
      tenantId: tenant.id,
      to: "pm@test.com",
      subject: "Test Email",
      body: "<p>Body</p>",
    });

    expect(result.recipient).toBe("pm@test.com");
    expect(result.deliveryStatus).toBe("SENT");
    expect(result.sentAt).toBeTruthy();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("should fail on invalid email", async () => {
    const tenant = await createTestTenant("agency-notify-send-2");

    await expect(
      notificationService.sendEmail({
        tenantId: tenant.id,
        to: "not-an-email",
        subject: "Subject",
        body: "Body",
      }),
    ).rejects.toThrow("Invalid email");
  });

  it("should fail when subject is missing", async () => {
    const tenant = await createTestTenant("agency-notify-send-3");

    await expect(
      notificationService.sendEmail({
        tenantId: tenant.id,
        to: "pm@test.com",
        subject: "  ",
        body: "Body",
      }),
    ).rejects.toThrow("Subject is required");
  });

  it("should fail when body is missing", async () => {
    const tenant = await createTestTenant("agency-notify-send-4");

    await expect(
      notificationService.sendEmail({
        tenantId: tenant.id,
        to: "pm@test.com",
        subject: "Subject",
        body: " ",
      }),
    ).rejects.toThrow("Body is required");
  });

  it("should fail when tenant is not found", async () => {
    await expect(
      notificationService.sendEmail({
        tenantId: "missing-tenant",
        to: "pm@test.com",
        subject: "Subject",
        body: "Body",
      }),
    ).rejects.toThrow("Tenant not found");
  });

  it("should create FAILED notification when provider throws", async () => {
    const tenant = await createTestTenant("agency-notify-send-5");
    mockSend.mockRejectedValueOnce(new Error("API down"));

    const result = await notificationService.sendEmail({
      tenantId: tenant.id,
      to: "pm@test.com",
      subject: "Subject",
      body: "Body",
    });

    expect(result.deliveryStatus).toBe("FAILED");
    expect(result.errorMessage).toContain("API down");
    expect(result.sentAt).toBeNull();
  });

  it("should create FAILED notification when provider returns error payload", async () => {
    const tenant = await createTestTenant("agency-notify-send-6");
    mockSend.mockResolvedValueOnce({ error: { message: "rate limited" } });

    const result = await notificationService.sendEmail({
      tenantId: tenant.id,
      to: "pm@test.com",
      subject: "Subject",
      body: "Body",
    });

    expect(result.deliveryStatus).toBe("FAILED");
    expect(result.errorMessage).toContain("rate limited");
  });

  it("should default template key to custom", async () => {
    const tenant = await createTestTenant("agency-notify-send-7");

    const result = await notificationService.sendEmail({
      tenantId: tenant.id,
      to: "pm@test.com",
      subject: "Subject",
      body: "Body",
    });

    expect(result.templateKey).toBe("custom");
  });

  it("should persist subject and body inside payload for retries", async () => {
    const tenant = await createTestTenant("agency-notify-send-8");

    const result = await notificationService.sendEmail({
      tenantId: tenant.id,
      to: "pm@test.com",
      subject: "Retry Subject",
      body: "Retry Body",
      payload: { key: "value" },
    });

    const stored = await prisma.notification.findUnique({ where: { id: result.id } });
    expect(stored?.payload).toMatchObject({
      key: "value",
      subject: "Retry Subject",
      body: "Retry Body",
    });
  });

  it("should require api key when constructing without injected client", async () => {
    const prev = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    expect(() => new NotificationService(prisma as PrismaClient)).toThrow("RESEND_API_KEY is required");

    process.env.RESEND_API_KEY = prev;
  });
});

describe("NotificationService template methods", () => {
  beforeEach(async () => {
    await cleanup();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.NOTIFICATION_FROM_EMAIL = "noreply@test.local";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    mockSend.mockReset();
    mockSend.mockResolvedValue({ id: "mock-email-id" });
    notificationService = new NotificationService(prisma as PrismaClient);
  });

  it("should notify PM about new feedback", async () => {
    const tenant = await createTestTenant("agency-notify-pm-1");
    const user = await createTestUser(tenant.id, "pm-1@test.com");
    const client = await createTestClient(tenant.id, "client-1@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project One");
    const version = await createTestAssetVersion(project.id, user.id);
    const feedback = await createTestFeedback(version.id, "Please cut first 5s");

    const result = await notificationService.notifyPMAboutNewFeedback({
      tenantId: tenant.id,
      projectId: project.id,
      feedbackId: feedback.id,
      pmEmail: "pm-1@test.com",
    });

    expect(result.templateKey).toBe("new_feedback");
    expect(result.recipient).toBe("pm-1@test.com");
    expect(result.deliveryStatus).toBe("SENT");
  });

  it("should reject PM feedback notification for wrong tenant", async () => {
    const tenantA = await createTestTenant("agency-notify-pm-2a");
    const tenantB = await createTestTenant("agency-notify-pm-2b");
    const user = await createTestUser(tenantA.id, "pm-2@test.com");
    const client = await createTestClient(tenantA.id, "client-2@test.com");
    const project = await createTestProject(tenantA.id, client.id, "Project One");
    const version = await createTestAssetVersion(project.id, user.id);
    const feedback = await createTestFeedback(version.id, "Wrong tenant");

    await expect(
      notificationService.notifyPMAboutNewFeedback({
        tenantId: tenantB.id,
        projectId: project.id,
        feedbackId: feedback.id,
        pmEmail: "pm-2@test.com",
      }),
    ).rejects.toThrow("Feedback not found in this tenant");
  });

  it("should reject PM feedback notification for wrong project", async () => {
    const tenant = await createTestTenant("agency-notify-pm-3");
    const user = await createTestUser(tenant.id, "pm-3@test.com");
    const client = await createTestClient(tenant.id, "client-3@test.com");
    const projectA = await createTestProject(tenant.id, client.id, "Project A");
    const projectB = await createTestProject(tenant.id, client.id, "Project B");
    const version = await createTestAssetVersion(projectA.id, user.id);
    const feedback = await createTestFeedback(version.id, "Wrong project");

    await expect(
      notificationService.notifyPMAboutNewFeedback({
        tenantId: tenant.id,
        projectId: projectB.id,
        feedbackId: feedback.id,
        pmEmail: "pm-3@test.com",
      }),
    ).rejects.toThrow("Feedback not found in this tenant");
  });

  it("should notify client about new version", async () => {
    const tenant = await createTestTenant("agency-notify-client-1");
    const user = await createTestUser(tenant.id, "pm-client-1@test.com");
    const client = await createTestClient(tenant.id, "client-10@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project Client");
    const version = await createTestAssetVersion(project.id, user.id, { versionNo: 3 });

    const result = await notificationService.notifyClientAboutNewVersion({
      tenantId: tenant.id,
      projectId: project.id,
      versionId: version.id,
      clientEmail: "client-10@test.com",
      clientName: "Anna",
    });

    expect(result.templateKey).toBe("version_uploaded");
    expect(result.recipient).toBe("client-10@test.com");
    expect(result.deliveryStatus).toBe("SENT");
  });

  it("should reject client version notification for wrong tenant", async () => {
    const tenantA = await createTestTenant("agency-notify-client-2a");
    const tenantB = await createTestTenant("agency-notify-client-2b");
    const user = await createTestUser(tenantA.id, "pm-client-2@test.com");
    const client = await createTestClient(tenantA.id, "client-20@test.com");
    const project = await createTestProject(tenantA.id, client.id, "Project A");
    const version = await createTestAssetVersion(project.id, user.id);

    await expect(
      notificationService.notifyClientAboutNewVersion({
        tenantId: tenantB.id,
        projectId: project.id,
        versionId: version.id,
        clientEmail: "client-20@test.com",
        clientName: "Client",
      }),
    ).rejects.toThrow("Version not found in this tenant");
  });

  it("should validate client email in version notification", async () => {
    const tenant = await createTestTenant("agency-notify-client-3");
    const user = await createTestUser(tenant.id, "pm-client-3@test.com");
    const client = await createTestClient(tenant.id, "client-30@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");
    const version = await createTestAssetVersion(project.id, user.id);

    await expect(
      notificationService.notifyClientAboutNewVersion({
        tenantId: tenant.id,
        projectId: project.id,
        versionId: version.id,
        clientEmail: "invalid-email",
        clientName: "Client",
      }),
    ).rejects.toThrow("Invalid email");
  });

  it("should notify PM about overdue stage", async () => {
    const tenant = await createTestTenant("agency-notify-stage-1");
    const client = await createTestClient(tenant.id, "stage-client-1@test.com");
    const project = await createTestProject(tenant.id, client.id, "Workflow Project");

    await prisma.workflowStage.create({
      data: {
        projectId: project.id,
        stageName: "PRODUCTION",
        slaHours: 1,
        startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
    });

    const result = await notificationService.notifyPMAboutOverdueStage({
      tenantId: tenant.id,
      projectId: project.id,
      stageName: "PRODUCTION",
      pmEmail: "pm-stage-1@test.com",
    });

    expect(result.templateKey).toBe("stage_overdue");
    expect(result.deliveryStatus).toBe("SENT");
  });

  it("should reject overdue stage notification when stage is missing", async () => {
    const tenant = await createTestTenant("agency-notify-stage-2");
    const client = await createTestClient(tenant.id, "stage-client-2@test.com");
    const project = await createTestProject(tenant.id, client.id, "Workflow Project");

    await expect(
      notificationService.notifyPMAboutOverdueStage({
        tenantId: tenant.id,
        projectId: project.id,
        stageName: "DELIVERY",
        pmEmail: "pm-stage-2@test.com",
      }),
    ).rejects.toThrow("Stage not found in this tenant");
  });

  it("should store zero overdue hours for non-overdue stage", async () => {
    const tenant = await createTestTenant("agency-notify-stage-3");
    const client = await createTestClient(tenant.id, "stage-client-3@test.com");
    const project = await createTestProject(tenant.id, client.id, "Workflow Project");

    await prisma.workflowStage.create({
      data: {
        projectId: project.id,
        stageName: "CLIENT_REVIEW",
        slaHours: 10,
        startedAt: new Date(),
      },
    });

    const result = await notificationService.notifyPMAboutOverdueStage({
      tenantId: tenant.id,
      projectId: project.id,
      stageName: "CLIENT_REVIEW",
      pmEmail: "pm-stage-3@test.com",
    });

    const stored = await prisma.notification.findUnique({
      where: { id: result.id },
    });
    expect(stored?.payload).toMatchObject({ overdueHours: 0 });
  });
});

describe("NotificationService queries and retry", () => {
  beforeEach(async () => {
    await cleanup();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.NOTIFICATION_FROM_EMAIL = "noreply@test.local";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    mockSend.mockReset();
    mockSend.mockResolvedValue({ id: "mock-email-id" });
    notificationService = new NotificationService(prisma as PrismaClient);
  });

  it("should list notifications by tenant with limit and order", async () => {
    const tenant = await createTestTenant("agency-notify-list-1");
    const otherTenant = await createTestTenant("agency-notify-list-2");

    await notificationService.sendEmail({
      tenantId: tenant.id,
      to: "first@test.com",
      subject: "First",
      body: "First",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await notificationService.sendEmail({
      tenantId: tenant.id,
      to: "second@test.com",
      subject: "Second",
      body: "Second",
    });
    await notificationService.sendEmail({
      tenantId: otherTenant.id,
      to: "other@test.com",
      subject: "Other",
      body: "Other",
    });

    const result = await notificationService.getNotificationsByTenant(tenant.id, 1);
    expect(result).toHaveLength(1);
    expect(result[0].recipient).toBe("second@test.com");
  });

  it("should fail list when tenantId is empty", async () => {
    await expect(notificationService.getNotificationsByTenant("")).rejects.toThrow("tenantId is required");
  });

  it("should retry failed notification and update same record", async () => {
    const tenant = await createTestTenant("agency-notify-retry-1");
    mockSend.mockRejectedValueOnce(new Error("temp error"));

    const failed = await notificationService.sendEmail({
      tenantId: tenant.id,
      to: "retry@test.com",
      subject: "Retry me",
      body: "Body",
      templateKey: "retry_template",
    });
    expect(failed.deliveryStatus).toBe("FAILED");

    mockSend.mockResolvedValueOnce({ id: "retry-success" });
    const retried = await notificationService.retryFailedNotification(failed.id, tenant.id);

    expect(retried.id).toBe(failed.id);
    expect(retried.deliveryStatus).toBe("SENT");
    expect(retried.errorMessage).toBeNull();
    expect(retried.sentAt).toBeTruthy();
  });

  it("should fail retry when notification does not exist in tenant", async () => {
    const tenantA = await createTestTenant("agency-notify-retry-2a");
    const tenantB = await createTestTenant("agency-notify-retry-2b");

    mockSend.mockRejectedValueOnce(new Error("temp error"));
    const failed = await notificationService.sendEmail({
      tenantId: tenantA.id,
      to: "retry-tenant@test.com",
      subject: "Retry me",
      body: "Body",
    });

    await expect(notificationService.retryFailedNotification(failed.id, tenantB.id)).rejects.toThrow(
      "Notification not found",
    );
  });

  it("should fail retry when notification is not FAILED", async () => {
    const tenant = await createTestTenant("agency-notify-retry-3");
    const sent = await notificationService.sendEmail({
      tenantId: tenant.id,
      to: "sent@test.com",
      subject: "Sent",
      body: "Body",
    });

    await expect(notificationService.retryFailedNotification(sent.id, tenant.id)).rejects.toThrow(
      "Only FAILED notifications can be retried",
    );
  });

  it("should fail retry for non-email channel", async () => {
    const tenant = await createTestTenant("agency-notify-retry-4");
    const record = await prisma.notification.create({
      data: {
        tenantId: tenant.id,
        channel: "SLACK",
        recipient: "U123",
        templateKey: "slack_template",
        payload: { subject: "s", body: "b" },
        deliveryStatus: "FAILED",
      },
    });

    await expect(notificationService.retryFailedNotification(record.id, tenant.id)).rejects.toThrow(
      "Only EMAIL notifications can be retried",
    );
  });

  it("should fail retry when payload has no subject/body", async () => {
    const tenant = await createTestTenant("agency-notify-retry-5");
    const record = await prisma.notification.create({
      data: {
        tenantId: tenant.id,
        channel: "EMAIL",
        recipient: "a@test.com",
        templateKey: "email_template",
        payload: { arbitrary: 1 },
        deliveryStatus: "FAILED",
      },
    });

    await expect(notificationService.retryFailedNotification(record.id, tenant.id)).rejects.toThrow(
      "Notification payload missing subject/body for retry",
    );
  });

  it("should keep FAILED status when retry fails again", async () => {
    const tenant = await createTestTenant("agency-notify-retry-6");
    mockSend.mockRejectedValueOnce(new Error("initial fail"));
    const failed = await notificationService.sendEmail({
      tenantId: tenant.id,
      to: "retry-fail@test.com",
      subject: "Retry fail",
      body: "Body",
    });

    mockSend.mockRejectedValueOnce(new Error("still failing"));
    const retried = await notificationService.retryFailedNotification(failed.id, tenant.id);

    expect(retried.deliveryStatus).toBe("FAILED");
    expect(retried.errorMessage).toContain("still failing");
    expect(retried.sentAt).toBeNull();
  });
});
