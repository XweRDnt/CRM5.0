import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteFeedbackMock = vi.fn();
const findFirstMock = vi.fn();
const isDemoTokenMock = vi.fn();
const handleAPIErrorMock = vi.fn((error: unknown) =>
  Response.json({ error: error instanceof Error ? error.message : "unknown" }, { status: 500 }),
);

vi.mock("@/lib/utils/db", () => ({
  prisma: {
    feedbackItem: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
    },
  },
}));

vi.mock("@/lib/services/feedback.service", () => ({
  FeedbackService: class {
    deleteFeedback = deleteFeedbackMock;
  },
}));

vi.mock("@/lib/utils/demo-token", () => ({
  isDemoToken: (token: string) => isDemoTokenMock(token),
}));

vi.mock("@/lib/utils/api-error", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils/api-error")>("@/lib/utils/api-error");
  return {
    ...actual,
    handleAPIError: (error: unknown) => handleAPIErrorMock(error),
  };
});

import { DELETE } from "@/app/api/public/feedback/[id]/route";

describe("DELETE /api/public/feedback/[id]", () => {
  beforeEach(() => {
    deleteFeedbackMock.mockReset();
    findFirstMock.mockReset();
    isDemoTokenMock.mockReset();
    handleAPIErrorMock.mockClear();
  });

  it("deletes feedback for the matching portal token", async () => {
    isDemoTokenMock.mockReturnValue(false);
    findFirstMock.mockResolvedValue({
      assetVersion: {
        project: {
          tenantId: "tenant-1",
          portalToken: "portal-token",
        },
      },
    });

    const response = await DELETE(
      new Request("http://localhost/api/public/feedback/feedback-1", {
        method: "DELETE",
        body: JSON.stringify({ token: "portal-token" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "feedback-1" }) },
    );

    expect(response.status).toBe(200);
    expect(deleteFeedbackMock).toHaveBeenCalledWith("feedback-1", "tenant-1");
  });

  it("rejects demo token deletion", async () => {
    isDemoTokenMock.mockReturnValue(true);
    findFirstMock.mockResolvedValue({
      assetVersion: {
        project: {
          tenantId: "tenant-1",
          portalToken: "portal-token",
        },
      },
    });

    const response = await DELETE(
      new Request("http://localhost/api/public/feedback/feedback-1", {
        method: "DELETE",
        body: JSON.stringify({ token: "portal-token" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "feedback-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "DEMO_READONLY" });
    expect(deleteFeedbackMock).not.toHaveBeenCalled();
  });
});
