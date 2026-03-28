import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyTokenMock = vi.fn();
const isWorkspaceBlockedMock = vi.fn();

vi.mock("@/lib/services/auth.service", () => ({
  authService: {
    verifyToken: verifyTokenMock,
    isWorkspaceBlocked: isWorkspaceBlockedMock,
  },
}));

describe("withAuth", () => {
  beforeEach(() => {
    verifyTokenMock.mockReset();
    isWorkspaceBlockedMock.mockReset();
    isWorkspaceBlockedMock.mockResolvedValue(false);
  });

  it("accepts authToken from cookies when Authorization header is absent", async () => {
    verifyTokenMock.mockResolvedValue({
      userId: "user_1",
      tenantId: "tenant_1",
      role: "OWNER",
    });

    const { withAuth } = await import("@/lib/middleware/auth");
    const handler = withAuth(async (request) => Response.json({ tenantId: request.user.tenantId }, { status: 200 }));

    const response = await handler(
      new Request("http://localhost/api/projects", {
        headers: {
          cookie: "authToken=cookie-token; tenantId=tenant_1",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ tenantId: "tenant_1" });
    expect(verifyTokenMock).toHaveBeenCalledWith("cookie-token");
  });
});
