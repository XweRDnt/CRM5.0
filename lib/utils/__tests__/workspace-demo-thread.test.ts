import { describe, expect, it } from "vitest";

import { appendWorkspaceDemoThreadMessage, canReplyInWorkspaceThread } from "@/lib/utils/workspace-demo-thread";
import type { AuthUser } from "@/lib/hooks/use-auth-guard";
import type { FeedbackThreadMessageResponse } from "@/types";

const demoUser: AuthUser = {
  id: "user_1",
  firstName: "Creative",
  lastName: "GPT",
  email: "demo@example.com",
  role: "OWNER",
  isAdmin: false,
  isDemo: true,
  tenant: {
    id: "tenant_1",
    name: "Demo tenant",
    slug: "demo-tenant",
  },
};

describe("workspace demo thread helpers", () => {
  it("allows demo users to reply in workspace threads", () => {
    expect(canReplyInWorkspaceThread(demoUser)).toBe(true);
  });

  it("appends an in-memory demo message without mutating existing thread entries", () => {
    const existing: Record<string, FeedbackThreadMessageResponse[]> = {
      feedback_1: [
        {
          id: "message_1",
          feedbackItemId: "feedback_1",
          authorType: "CLIENT",
          author: {
            id: "client_1",
            name: "Client",
            role: "CLIENT",
          },
          text: "Initial message",
          createdAt: new Date("2026-03-25T12:00:00.000Z"),
        },
      ],
    };

    const now = new Date("2026-03-25T12:05:00.000Z");
    const next = appendWorkspaceDemoThreadMessage(existing, "feedback_1", demoUser, "Local demo reply", now);

    expect(existing.feedback_1).toHaveLength(1);
    expect(next.feedback_1).toHaveLength(2);
    expect(next.feedback_1[1]).toMatchObject({
      feedbackItemId: "feedback_1",
      authorType: "USER",
      text: "Local demo reply",
      author: {
        id: "user_1",
        name: "Creative GPT",
        role: "OWNER",
        email: "demo@example.com",
      },
    });
    expect(next.feedback_1[1].id).toContain("demo-feedback_1-");
    expect(next.feedback_1[1].createdAt).toEqual(now);
  });
});
