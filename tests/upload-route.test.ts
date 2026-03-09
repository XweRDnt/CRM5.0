import { beforeEach, describe, expect, it, vi } from "vitest";
import { APIError } from "@/lib/utils/api-error";

const verifyTokenMock = vi.fn();
const isWorkspaceBlockedMock = vi.fn();
const assertProjectAccessMock = vi.fn();
const assertCanUploadToKinescopeMock = vi.fn();
const ensureWorkspaceProjectForTenantMock = vi.fn();
const createUploadSessionMock = vi.fn();

vi.mock("@/lib/services/auth.service", () => ({
  authService: {
    verifyToken: verifyTokenMock,
    isWorkspaceBlocked: isWorkspaceBlockedMock,
  },
}));

vi.mock("@/lib/services/access-control.service", () => ({
  assertProjectAccess: assertProjectAccessMock,
}));

vi.mock("@/lib/services/billing-guard.service", () => ({
  billingGuardService: {
    assertCanUploadToKinescope: assertCanUploadToKinescopeMock,
  },
}));

vi.mock("@/lib/services/kinescope-workspace-project.service", () => ({
  kinescopeWorkspaceProjectService: {
    ensureWorkspaceProjectForTenant: ensureWorkspaceProjectForTenantMock,
  },
}));

vi.mock("@/lib/services/kinescope.service", () => ({
  getKinescopeService: () => ({
    createUploadSession: createUploadSessionMock,
  }),
}));

function createAuthorizedRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/upload", {
    method: "POST",
    headers: {
      Authorization: "Bearer token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    verifyTokenMock.mockReset();
    isWorkspaceBlockedMock.mockReset();
    assertProjectAccessMock.mockReset();
    assertCanUploadToKinescopeMock.mockReset();
    ensureWorkspaceProjectForTenantMock.mockReset();
    createUploadSessionMock.mockReset();

    verifyTokenMock.mockResolvedValue({
      userId: "user_1",
      tenantId: "tenant_1",
      role: "PM",
      email: "pm@example.com",
    });
    isWorkspaceBlockedMock.mockResolvedValue(false);
    assertProjectAccessMock.mockResolvedValue(undefined);
    assertCanUploadToKinescopeMock.mockResolvedValue(undefined);
    ensureWorkspaceProjectForTenantMock.mockResolvedValue("k_workspace_project");
    createUploadSessionMock.mockResolvedValue({
      uploadUrl: "https://upload.test",
      uploadMethod: "POST",
      kinescopeVideoId: "video_1",
      expiresAt: "2026-03-08T00:00:00.000Z",
      expiresIn: 3600,
    });
  });

  it("returns 400 when monthly minutes are enforced but durationSec is missing", async () => {
    assertCanUploadToKinescopeMock.mockRejectedValue(
      new APIError(400, "Video duration is required to enforce the monthly upload minutes limit.", "BAD_REQUEST"),
    );
    const { POST } = await import("@/app/api/upload/route");

    const response = await POST(
      createAuthorizedRequest({
        projectId: "project_1",
        fileName: "video.mp4",
        fileType: "video/mp4",
        fileSize: 10_000_000,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Video duration is required to enforce the monthly upload minutes limit.",
      code: "BAD_REQUEST",
    });
  });

  it("returns 402 when projected storage would exceed the plan", async () => {
    assertCanUploadToKinescopeMock.mockRejectedValue(
      new APIError(402, "Storage limit would be exceeded for current plan.", "PLAN_LIMIT_EXCEEDED"),
    );
    const { POST } = await import("@/app/api/upload/route");

    const response = await POST(
      createAuthorizedRequest({
        projectId: "project_1",
        fileName: "video.mp4",
        fileType: "video/mp4",
        fileSize: 10_000_000,
        durationSec: 120,
      }),
    );

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      error: "Storage limit would be exceeded for current plan.",
      code: "PLAN_LIMIT_EXCEEDED",
    });
  });

  it("returns 402 when projected monthly minutes would exceed the plan", async () => {
    assertCanUploadToKinescopeMock.mockRejectedValue(
      new APIError(402, "Monthly upload minutes limit would be exceeded for current plan.", "PLAN_LIMIT_EXCEEDED"),
    );
    const { POST } = await import("@/app/api/upload/route");

    const response = await POST(
      createAuthorizedRequest({
        projectId: "project_1",
        fileName: "video.mp4",
        fileType: "video/mp4",
        fileSize: 10_000_000,
        durationSec: 120,
      }),
    );

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      error: "Monthly upload minutes limit would be exceeded for current plan.",
      code: "PLAN_LIMIT_EXCEEDED",
    });
  });

  it("passes durationSec to the guard and Kinescope upload session creation", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const response = await POST(
      createAuthorizedRequest({
        projectId: "project_1",
        fileName: "video.mp4",
        fileType: "video/mp4",
        fileSize: 10_000_000,
        durationSec: 120,
      }),
    );

    expect(response.status).toBe(200);
    expect(assertCanUploadToKinescopeMock).toHaveBeenCalledWith({
      tenantId: "tenant_1",
      incomingFileSize: 10_000_000,
      incomingDurationSec: 120,
    });
    expect(createUploadSessionMock).toHaveBeenCalledWith(
      { tenantId: "tenant_1" },
      expect.objectContaining({
        projectId: "project_1",
        fileName: "video.mp4",
        fileType: "video/mp4",
        fileSize: 10_000_000,
        durationSec: 120,
        kinescopeParentId: "k_workspace_project",
      }),
    );
  });
});
