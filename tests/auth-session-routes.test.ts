import { beforeEach, describe, expect, it, vi } from "vitest";

const loginMock = vi.fn();
const signupMock = vi.fn();

vi.mock("@/lib/services/auth.service", () => ({
  authService: {
    login: loginMock,
    signup: signupMock,
  },
}));

describe("auth session routes", () => {
  beforeEach(() => {
    loginMock.mockReset();
    signupMock.mockReset();
  });

  it("sets auth cookies on login", async () => {
    loginMock.mockResolvedValue({
      token: "login-token",
      tenant: {
        id: "tenant_1",
        name: "Agency",
        slug: "agency",
      },
      user: {
        id: "user_1",
        email: "jane@example.com",
        firstName: "Jane",
        lastName: "Doe",
        role: "OWNER",
        tenantId: "tenant_1",
      },
    });

    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "jane@example.com",
          password: "securePass123",
        }),
      }),
    );

    const cookies = response.headers.getSetCookie();

    expect(response.status).toBe(200);
    expect(cookies).toEqual(expect.arrayContaining([expect.stringContaining("authToken=login-token")]));
    expect(cookies).toEqual(expect.arrayContaining([expect.stringContaining("tenantId=tenant_1")]));
  });

  it("sets auth cookies on signup", async () => {
    signupMock.mockResolvedValue({
      token: "signup-token",
      tenant: {
        id: "tenant_2",
        name: "Studio",
        slug: "studio",
      },
      user: {
        id: "user_2",
        email: "owner@example.com",
        firstName: "Owner",
        lastName: "User",
        role: "OWNER",
      },
    });

    const { POST } = await import("@/app/api/auth/signup/route");
    const response = await POST(
      new Request("http://localhost/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "owner@example.com",
          password: "securePass123",
          workspaceName: "Studio",
        }),
      }),
    );

    const cookies = response.headers.getSetCookie();

    expect(response.status).toBe(201);
    expect(cookies).toEqual(expect.arrayContaining([expect.stringContaining("authToken=signup-token")]));
    expect(cookies).toEqual(expect.arrayContaining([expect.stringContaining("tenantId=tenant_2")]));
  });
});
