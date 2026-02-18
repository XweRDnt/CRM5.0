import type { Notification, Prisma, PrismaClient, WorkflowStageName } from "@prisma/client";
import { Resend } from "resend";
import { prisma } from "@/lib/utils/db";
import type {
  NotificationResponse,
  NotifyAboutOverdueStageInput,
  NotifyClientAboutNewVersionInput,
  NotifyPMAboutNewFeedbackInput,
  SendEmailInput,
} from "@/types";

type ResendLike = {
  emails: {
    send: (input: { from: string; to: string; subject: string; html: string }) => Promise<unknown>;
  };
};

type RetryPayload = {
  subject?: string;
  body?: string;
  [key: string]: unknown;
};

export class NotificationService {
  private readonly resend: ResendLike;
  private readonly fromEmail: string;

  constructor(
    private readonly prismaClient: PrismaClient = prisma as PrismaClient,
    resendClient?: ResendLike,
  ) {
    this.fromEmail = process.env.NOTIFICATION_FROM_EMAIL || "noreply@example.com";

    if (resendClient) {
      this.resend = resendClient;
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is required");
    }

    this.resend = new Resend(apiKey) as unknown as ResendLike;
  }

  async sendEmail(input: SendEmailInput): Promise<NotificationResponse> {
    const tenantId = input.tenantId?.trim();
    const to = input.to?.trim();
    const subject = input.subject?.trim();
    const body = input.body?.trim();

    if (!tenantId) {
      throw new Error("tenantId is required");
    }
    if (!this.isValidEmail(to)) {
      throw new Error("Invalid email");
    }
    if (!subject) {
      throw new Error("Subject is required");
    }
    if (!body) {
      throw new Error("Body is required");
    }

    const tenant = await this.prismaClient.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    let sentAt: Date | null = null;
    let deliveryStatus: "SENT" | "FAILED" = "SENT";
    let errorMessage: string | null = null;

    try {
      const response = (await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html: body,
      })) as { error?: { message?: string } | null };

      if (response?.error) {
        throw new Error(response.error.message || "Email provider returned an error");
      }

      sentAt = new Date();
      deliveryStatus = "SENT";
    } catch (error) {
      deliveryStatus = "FAILED";
      errorMessage = this.normalizeErrorMessage(error);
    }

    const payload: Record<string, unknown> = {
      ...(input.payload ?? {}),
    };
    if (!("subject" in payload)) {
      payload.subject = subject;
    }
    if (!("body" in payload)) {
      payload.body = body;
    }

    const notification = await this.prismaClient.notification.create({
      data: {
        tenantId,
        channel: "EMAIL",
        recipient: to,
        templateKey: input.templateKey?.trim() || "custom",
        payload: payload as Prisma.InputJsonValue,
        sentAt,
        deliveryStatus,
        errorMessage,
      },
    });

    return this.mapNotificationResponse(notification);
  }

  async notifyPMAboutNewFeedback(input: NotifyPMAboutNewFeedbackInput): Promise<NotificationResponse> {
    const feedback = await this.prismaClient.feedbackItem.findFirst({
      where: {
        id: input.feedbackId,
        assetVersion: {
          project: {
            id: input.projectId,
            tenantId: input.tenantId,
          },
        },
      },
      include: {
        assetVersion: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!feedback) {
      throw new Error("Feedback not found in this tenant");
    }

    const authorName = feedback.authorName || feedback.authorEmail || "Unknown";
    const timecode = feedback.timecodeSec !== null ? this.formatTimecode(feedback.timecodeSec) : "N/A";
    const project = feedback.assetVersion.project;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    return this.sendEmail({
      tenantId: input.tenantId,
      to: input.pmEmail,
      subject: `New Feedback on ${project.name}`,
      body: `
        <h2>New Feedback Received</h2>
        <p>A new feedback has been submitted on project <strong>${this.escapeHtml(project.name)}</strong>.</p>
        <ul>
          <li><strong>Author:</strong> ${this.escapeHtml(authorName)}</li>
          <li><strong>Timecode:</strong> ${this.escapeHtml(timecode)}</li>
          <li><strong>Category:</strong> ${feedback.category || "N/A"}</li>
          <li><strong>Status:</strong> ${feedback.status}</li>
        </ul>
        <p><strong>Feedback Text:</strong></p>
        <p>${this.escapeHtml(feedback.text)}</p>
        <p><a href="${appUrl}/projects/${project.id}">View feedback in CRM</a></p>
      `,
      templateKey: "new_feedback",
      payload: {
        projectId: project.id,
        projectName: project.name,
        feedbackId: feedback.id,
        authorName,
        timecode,
        category: feedback.category,
        status: feedback.status,
      },
    });
  }

  async notifyClientAboutNewVersion(input: NotifyClientAboutNewVersionInput): Promise<NotificationResponse> {
    const version = await this.prismaClient.assetVersion.findFirst({
      where: {
        id: input.versionId,
        project: {
          id: input.projectId,
          tenantId: input.tenantId,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!version) {
      throw new Error("Version not found in this tenant");
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    return this.sendEmail({
      tenantId: input.tenantId,
      to: input.clientEmail,
      subject: `Your video is ready for review: ${version.project.name}`,
      body: `
        <h2>Your video is ready for review</h2>
        <p>Hi ${this.escapeHtml(input.clientName)},</p>
        <p>Version <strong>v${version.versionNo}</strong> for project <strong>${this.escapeHtml(version.project.name)}</strong> has been uploaded.</p>
        <p><a href="${appUrl}/projects/${version.project.id}">Open project</a></p>
      `,
      templateKey: "version_uploaded",
      payload: {
        projectId: version.project.id,
        projectName: version.project.name,
        versionId: version.id,
        versionNumber: version.versionNo,
        clientName: input.clientName,
      },
    });
  }

  async notifyPMAboutOverdueStage(input: NotifyAboutOverdueStageInput): Promise<NotificationResponse> {
    const stage = await this.prismaClient.workflowStage.findFirst({
      where: {
        projectId: input.projectId,
        project: {
          tenantId: input.tenantId,
        },
        stageName: input.stageName as WorkflowStageName,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!stage) {
      throw new Error("Stage not found in this tenant");
    }

    const overdueHours = this.getOverdueHours(stage.startedAt, stage.slaHours);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    return this.sendEmail({
      tenantId: input.tenantId,
      to: input.pmEmail,
      subject: `Stage ${input.stageName} is overdue`,
      body: `
        <h2>Stage Overdue Warning</h2>
        <p>Project <strong>${this.escapeHtml(stage.project.name)}</strong> has an overdue stage.</p>
        <ul>
          <li><strong>Stage:</strong> ${this.escapeHtml(input.stageName)}</li>
          <li><strong>Overdue:</strong> ${overdueHours} hour(s)</li>
        </ul>
        <p><a href="${appUrl}/projects/${stage.project.id}">Review project workflow</a></p>
      `,
      templateKey: "stage_overdue",
      payload: {
        projectId: stage.project.id,
        projectName: stage.project.name,
        stageName: input.stageName,
        overdueHours,
      },
    });
  }

  async getNotificationsByTenant(tenantId: string, limit = 50): Promise<NotificationResponse[]> {
    const normalizedTenantId = tenantId?.trim();
    if (!normalizedTenantId) {
      throw new Error("tenantId is required");
    }

    const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : 50;

    const notifications = await this.prismaClient.notification.findMany({
      where: { tenantId: normalizedTenantId },
      orderBy: { createdAt: "desc" },
      take: safeLimit,
    });

    return notifications.map((notification) => this.mapNotificationResponse(notification));
  }

  async retryFailedNotification(notificationId: string, tenantId: string): Promise<NotificationResponse> {
    const notification = await this.prismaClient.notification.findFirst({
      where: {
        id: notificationId,
        tenantId,
      },
    });

    if (!notification) {
      throw new Error("Notification not found");
    }
    if (notification.channel !== "EMAIL") {
      throw new Error("Only EMAIL notifications can be retried");
    }
    if (notification.deliveryStatus !== "FAILED") {
      throw new Error("Only FAILED notifications can be retried");
    }

    const payload = this.normalizeRetryPayload(notification.payload);
    const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
    const body = typeof payload.body === "string" ? payload.body.trim() : "";
    if (!subject || !body) {
      throw new Error("Notification payload missing subject/body for retry");
    }

    let sentAt: Date | null = null;
    let deliveryStatus: "SENT" | "FAILED" = "SENT";
    let errorMessage: string | null = null;

    try {
      const response = (await this.resend.emails.send({
        from: this.fromEmail,
        to: notification.recipient,
        subject,
        html: body,
      })) as { error?: { message?: string } | null };

      if (response?.error) {
        throw new Error(response.error.message || "Email provider returned an error");
      }

      sentAt = new Date();
      deliveryStatus = "SENT";
    } catch (error) {
      deliveryStatus = "FAILED";
      errorMessage = this.normalizeErrorMessage(error);
    }

    const updated = await this.prismaClient.notification.update({
      where: { id: notification.id },
      data: {
        sentAt,
        deliveryStatus,
        errorMessage,
      },
    });

    return this.mapNotificationResponse(updated);
  }

  private isValidEmail(email?: string): boolean {
    if (!email) {
      return false;
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private formatTimecode(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  private getOverdueHours(startedAt: Date | null, slaHours: number): number {
    if (!startedAt) {
      return 0;
    }
    const deadlineMs = startedAt.getTime() + slaHours * 60 * 60 * 1000;
    const overdueMs = Date.now() - deadlineMs;
    if (overdueMs <= 0) {
      return 0;
    }
    return Math.ceil(overdueMs / (60 * 60 * 1000));
  }

  private normalizeRetryPayload(payload: Prisma.JsonValue): RetryPayload {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return {};
    }

    return payload as RetryPayload;
  }

  private normalizeErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return "Unknown error";
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  private mapNotificationResponse(notification: Notification): NotificationResponse {
    return {
      id: notification.id,
      tenantId: notification.tenantId,
      channel: notification.channel,
      recipient: notification.recipient,
      templateKey: notification.templateKey,
      sentAt: notification.sentAt,
      deliveryStatus: notification.deliveryStatus,
      errorMessage: notification.errorMessage,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }
}

let notificationServiceInstance: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService();
  }

  return notificationServiceInstance;
}
