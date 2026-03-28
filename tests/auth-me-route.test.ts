import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.fn();
const isPlatformAdminEmailMock = vi.fn();

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: (handler: (request: Request & { user: { isDemo?: boolean } }) => Promise<Response>) => handler,
}));

vi.mock("@/lib/services/auth.service", () => ({
  authService: {
    getCurrentUser: getCurrentUserMock,
  },
}));

vi.mock("@/lib/services/platform-admin.service", () => ({
  isPlatformAdminEmail: isPlatformAdminEmailMock,
}));

describe("GET /api/auth/me route", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    isPlatformAdminEmailMock.mockReset();
  });

  it("does not expose passwordHash in the response payload", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user_1",
      tenantId: "tenant_1",
      role: "OWNER",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      passwordHash: "$2b$10$secret",
      isActive: true,
      createdAt: new Date("2026-03-27T00:00:00.000Z"),
      updatedAt: new Date("2026-03-27T00:00:00.000Z"),
      tenant: {
        id: "tenant_1",
        name: "Agency",
        slug: "agency",
      },
    });
    isPlatformAdminEmailMock.mockReturnValue(true);

    const { GET } = await import("@/app/api/auth/me/route");
    const request = new Request("http://localhost/api/auth/me", {
      headers: {
        Authorization: "Bearer test-token",
      },
    }) as Request & { user: { isDemo?: boolean } };

    request.user = { isDemo: false };

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.email).toBe("jane@example.com");
    expect(payload.passwordHash).toBeUndefined();
    expect(payload.isAdmin).toBe(true);
    expect(payload.isDemo).toBe(false);
  });
});
