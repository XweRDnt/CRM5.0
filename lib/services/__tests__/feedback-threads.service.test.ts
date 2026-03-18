import { describe, expect, it, vi } from "vitest";
import { FeedbackStatus } from "@/types";
import { FeedbackService } from "@/lib/services/feedback.service";

describe("FeedbackService thread and auto-status helpers", () => {
  it("creates a thread reply and reports unread metadata for another viewer", async () => {
    const createdAt = new Date("2026-03-18T12:00:00.000Z");
    const prismaMock = {
      feedbackItem: {
        findFirst: vi.fn().mockResolvedValue({
          id: "feedback-1",
          authorName: "Thread Client",
          author: null,
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "feedback-1",
            assetVersionId: "version-1",
            authorType: "CLIENT",
            authorEmail: "client@example.com",
            authorName: "Thread Client",
            timecodeSec: null,
            text: "Need a tighter opening.",
            annotationData: null,
            category: null,
            status: "NEW",
            createdAt,
            updatedAt: createdAt,
            author: null,
          },
        ]),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: "user-owner",
          firstName: "Olga",
          lastName: "Owner",
          email: "owner@example.com",
          role: "OWNER",
        }),
      },
      project: {
        findFirst: vi.fn().mockResolvedValue({ id: "project-1" }),
      },
      feedbackThreadMessage: {
        create: vi.fn().mockResolvedValue({
          id: "message-1",
          feedbackItemId: "feedback-1",
          authorType: "USER",
          authorUserId: "user-owner",
          authorName: "Olga Owner",
          authorRoleLabel: "OWNER",
          text: "Приняли, берём в работу.",
          createdAt,
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "message-1",
            feedbackItemId: "feedback-1",
            text: "Приняли, берём в работу.",
            createdAt,
          },
        ]),
      },
      feedbackThreadRead: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new FeedbackService(prismaMock as never) as FeedbackService & {
      createThreadMessage: (input: {
        feedbackId: string;
        tenantId: string;
        authorType: "USER";
        authorUserId: string;
        authorRole: "OWNER";
        text: string;
      }) => Promise<void>;
      listFeedbackByProjectWithThreadMeta: (input: {
        projectId: string;
        tenantId: string;
        viewerUserId: string;
      }) => Promise<Array<{
        id: string;
        threadMessageCount: number;
        threadUnreadCount: number;
        lastThreadMessagePreview: string | null;
      }>>;
    };

    await service.createThreadMessage({
      feedbackId: "feedback-1",
      tenantId: "tenant-1",
      authorType: "USER",
      authorUserId: "user-owner",
      authorRole: "OWNER",
      text: "Приняли, берём в работу.",
    });

    const items = await service.listFeedbackByProjectWithThreadMeta({
      projectId: "project-1",
      tenantId: "tenant-1",
      viewerUserId: "user-pm",
    });

    expect(items).toEqual([
      expect.objectContaining({
        id: "feedback-1",
        threadMessageCount: 1,
        threadUnreadCount: 1,
        lastThreadMessagePreview: "Приняли, берём в работу.",
      }),
    ]);
  });

  it("moves feedback to in-progress on xml export and to resolved on new version upload", async () => {
    const feedbackState: { status: FeedbackStatus } = { status: FeedbackStatus.NEW };
    const prismaMock = {
      feedbackItem: {
        updateMany: vi.fn().mockImplementation(async ({ data }: { data: { status: FeedbackStatus } }) => {
          feedbackState.status = data.status;
          return { count: 1 };
        }),
        findFirst: vi.fn().mockImplementation(async () => ({
          id: "feedback-1",
          assetVersionId: "version-1",
          authorType: "CLIENT",
          authorEmail: "client@example.com",
          authorName: "Client",
          timecodeSec: null,
          text: "Please adjust the CTA timing.",
          annotationData: null,
          category: null,
          status: feedbackState.status,
          createdAt: new Date("2026-03-18T12:00:00.000Z"),
          updatedAt: new Date("2026-03-18T12:00:00.000Z"),
          author: null,
        })),
      },
    };

    const service = new FeedbackService(prismaMock as never) as FeedbackService & {
      markVersionFeedbackInProgress: (input: { versionId: string; tenantId: string }) => Promise<void>;
      resolvePreviousVersionFeedback: (input: { previousVersionId: string; tenantId: string }) => Promise<void>;
      getFeedbackById: (feedbackId: string, tenantId: string) => Promise<{ status: FeedbackStatus }>;
    };

    await service.markVersionFeedbackInProgress({
      versionId: "version-1",
      tenantId: "tenant-1",
    });

    expect((await service.getFeedbackById("feedback-1", "tenant-1")).status).toBe(FeedbackStatus.IN_PROGRESS);

    await service.resolvePreviousVersionFeedback({
      previousVersionId: "version-1",
      tenantId: "tenant-1",
    });

    expect((await service.getFeedbackById("feedback-1", "tenant-1")).status).toBe(FeedbackStatus.RESOLVED);
  });
});
