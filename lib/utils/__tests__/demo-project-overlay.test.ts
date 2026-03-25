import { describe, expect, it } from "vitest";

import {
  appendDemoProjectThreadMessage,
  createDemoProjectFeedback,
  mergeDemoProjectThreadMessages,
  mergePortalFeedbackWithDemoOverlay,
  mergeWorkspaceFeedbackWithDemoOverlay,
  type DemoProjectOverlay,
} from "@/lib/utils/demo-project-overlay";
import type { AnnotationData, FeedbackResponse, FeedbackThreadMessageResponse } from "@/types";

describe("demo project overlay", () => {
  it("creates local portal feedback and exposes it in portal and workspace projections", () => {
    const overlay: DemoProjectOverlay = { feedback: [], threadMessages: [] };
    const annotationData: AnnotationData = {
      version: 1,
      strokes: [
        {
          type: "rect",
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.2, y: 0.2 },
          ],
          color: "red",
          thickness: "medium",
        },
      ],
    };

    const { overlay: next, feedbackId } = createDemoProjectFeedback(overlay, {
      assetVersionId: "version_1",
      authorName: "Pasha",
      authorEmail: null,
      text: "Локальная демо-правка",
      timecodeSec: 12,
      annotationData,
      createdAt: new Date("2026-03-25T12:00:00.000Z"),
    });

    const portalFeedback = mergePortalFeedbackWithDemoOverlay([], next, "version_1");
    const workspaceFeedback = mergeWorkspaceFeedbackWithDemoOverlay([], next, "version_1");

    expect(feedbackId).toContain("demo-feedback-version_1-");
    expect(portalFeedback[0]).toMatchObject({
      id: feedbackId,
      text: "Локальная демо-правка",
      authorName: "Pasha",
      timecodeSec: 12,
      annotationData,
    });
    expect(workspaceFeedback[0]).toMatchObject({
      id: feedbackId,
      text: "Локальная демо-правка",
      assetVersionId: "version_1",
      authorType: "CLIENT",
      author: {
        name: "Pasha",
      },
      timecodeSec: 12,
      annotationData,
    });
  });

  it("merges local thread messages into both portal and workspace thread views and thread meta", () => {
    const baseFeedback: FeedbackResponse[] = [
      {
        id: "feedback_1",
        assetVersionId: "version_1",
        authorType: "CLIENT",
        author: { name: "Client" },
        timecodeSec: 12,
        text: "Base",
        category: null,
        status: "NEW",
        threadMessageCount: 1,
        threadUnreadCount: 0,
        lastThreadMessageAt: new Date("2026-03-25T12:00:00.000Z"),
        lastThreadMessagePreview: "Server reply",
        createdAt: new Date("2026-03-25T11:59:00.000Z"),
        updatedAt: new Date("2026-03-25T11:59:00.000Z"),
      },
    ];
    const baseMessages: FeedbackThreadMessageResponse[] = [
      {
        id: "message_1",
        feedbackItemId: "feedback_1",
        authorType: "USER",
        author: { id: "user_1", name: "Editor", role: "OWNER" },
        text: "Server reply",
        createdAt: new Date("2026-03-25T12:00:00.000Z"),
      },
    ];

    const appended = appendDemoProjectThreadMessage({ feedback: [], threadMessages: [] }, {
      feedbackItemId: "feedback_1",
      authorType: "CLIENT",
      authorName: "Pasha",
      authorRole: "CLIENT",
      authorEmail: null,
      text: "Local client reply",
      createdAt: new Date("2026-03-25T12:05:00.000Z"),
    });

    const mergedMessages = mergeDemoProjectThreadMessages(baseMessages, appended.overlay, "feedback_1");
    const mergedFeedback = mergeWorkspaceFeedbackWithDemoOverlay(baseFeedback, appended.overlay, "version_1");

    expect(mergedMessages).toHaveLength(2);
    expect(mergedMessages[1]).toMatchObject({
      feedbackItemId: "feedback_1",
      authorType: "CLIENT",
      author: {
        name: "Pasha",
        role: "CLIENT",
      },
      text: "Local client reply",
    });
    expect(mergedFeedback[0]).toMatchObject({
      threadMessageCount: 2,
      lastThreadMessagePreview: "Local client reply",
    });
    expect(mergedFeedback[0].lastThreadMessageAt).toEqual(new Date("2026-03-25T12:05:00.000Z"));
  });
});
