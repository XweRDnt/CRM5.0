import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueMock = vi.fn();
const findFirstMock = vi.fn();
const findManyMock = vi.fn();
const isWorkspaceDemoTokenMock = vi.fn();
const handleAPIErrorMock = vi.fn((error: unknown) =>
  Response.json({ error: error instanceof Error ? error.message : "unknown" }, { status: 500 }),
);

vi.mock("@/lib/utils/db", () => ({
  prisma: {
    workspace: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
    project: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
    },
    feedbackItem: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

vi.mock("@/lib/utils/workspace-demo-token", () => ({
  isWorkspaceDemoToken: (token: string) => isWorkspaceDemoTokenMock(token),
}));

vi.mock("@/lib/utils/api-error", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils/api-error")>("@/lib/utils/api-error");
  return {
    ...actual,
    handleAPIError: (error: unknown) => handleAPIErrorMock(error),
  };
});

import { GET } from "@/app/api/public/workspace-demo/[token]/projects/[projectId]/route";

describe("GET /api/public/workspace-demo/[token]/projects/[projectId]", () => {
  beforeEach(() => {
    process.env.DEMO_WORKSPACE_ID = "workspace-1";
    findUniqueMock.mockReset();
    findFirstMock.mockReset();
    findManyMock.mockReset();
    isWorkspaceDemoTokenMock.mockReset();
    handleAPIErrorMock.mockClear();
  });

  it("rejects an invalid workspace demo token", async () => {
    isWorkspaceDemoTokenMock.mockReturnValue(false);

    const response = await GET(new Request("http://localhost/api/public/workspace-demo/bad/projects/project-1"), {
      params: Promise.resolve({ token: "bad", projectId: "project-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns read-only project review payload for the configured workspace", async () => {
    isWorkspaceDemoTokenMock.mockReturnValue(true);
    findUniqueMock.mockResolvedValue({ id: "workspace-1", tenantId: "tenant-1", name: "Demo workspace" });
    findFirstMock.mockResolvedValue({
      id: "project-1",
      tenantId: "tenant-1",
      name: "Demo project",
      status: "CLIENT_REVIEW",
      portalToken: "portal-token",
      client: { id: "client-1", contactName: "Client", email: "client@example.com" },
      versions: [
        {
          id: "version-2",
          projectId: "project-1",
          versionNo: 2,
          fileUrl: "https://kinescope.io/video-2",
          fileName: "video-2.mp4",
          fileSize: 123,
          durationSec: 120,
          videoProvider: "KINESCOPE",
          kinescopeVideoId: "video-2",
          kinescopeAssetId: null,
          kinescopeProjectId: null,
          streamUrl: "https://kinescope.io/video-2",
          processingStatus: "READY",
          processingError: null,
          uploadedBy: { id: "user-1", firstName: "Ivan", lastName: "Petrov" },
          notes: null,
          changeLog: null,
          status: "IN_REVIEW",
          approvedBy: null,
          approvedAt: null,
          createdAt: new Date("2026-03-25T10:00:00.000Z"),
        },
      ],
    });
    findManyMock.mockResolvedValue([
      {
        id: "feedback-1",
        assetVersionId: "version-2",
        authorType: "CLIENT",
        authorName: "Client",
        authorEmail: "client@example.com",
        text: "Tighten the opening beat",
        status: "NEW",
        timecodeSec: 12,
        category: "CONTENT",
        annotationData: null,
        createdAt: new Date("2026-03-25T10:05:00.000Z"),
        updatedAt: new Date("2026-03-25T10:05:00.000Z"),
        threadMessages: [
          {
            id: "thread-1",
            text: "Will update this",
            createdAt: new Date("2026-03-25T10:07:00.000Z"),
          },
        ],
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/public/workspace-demo/workspace-demo-secret/projects/project-1?versionId=version-2"),
      {
        params: Promise.resolve({ token: "workspace-demo-secret", projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      workspace: { id: "workspace-1", name: "Demo workspace" },
      project: { id: "project-1", name: "Demo project", portalToken: "portal-token" },
      activeVersionId: "version-2",
      versions: [
        {
          id: "version-2",
          versionNumber: 2,
          status: "IN_REVIEW",
        },
      ],
      feedback: [
        {
          id: "feedback-1",
          text: "Tighten the opening beat",
          threadMessageCount: 1,
          lastThreadMessagePreview: "Will update this",
        },
      ],
      readonly: true,
    });
  });
});
