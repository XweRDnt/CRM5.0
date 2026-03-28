/** @vitest-environment jsdom */

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthGuard } from "@/components/auth/auth-guard";

const replaceMock = vi.fn();
const clearWorkspaceDemoTokenMock = vi.fn();
const getAuthTokenStateMock = vi.fn();
const readCachedAuthUserMock = vi.fn();
const writeCachedAuthUserMock = vi.fn();
const clearCachedAuthUserMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects",
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("swr", () => ({
  mutate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/utils/client-api", () => ({
  clearWorkspaceDemoToken: () => clearWorkspaceDemoTokenMock(),
  getAuthTokenState: () => getAuthTokenStateMock(),
  readCachedAuthUser: () => readCachedAuthUserMock(),
  writeCachedAuthUser: (user: unknown) => writeCachedAuthUserMock(user),
  clearCachedAuthUser: () => clearCachedAuthUserMock(),
}));

describe("useAuthGuard", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    clearWorkspaceDemoTokenMock.mockReset();
    getAuthTokenStateMock.mockReset();
    readCachedAuthUserMock.mockReset();
    writeCachedAuthUserMock.mockReset();
    clearCachedAuthUserMock.mockReset();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("renders immediately from cached auth user while background validation runs", () => {
    getAuthTokenStateMock.mockReturnValue({ source: "auth", token: "cached-token" });
    readCachedAuthUserMock.mockReturnValue({
      id: "user_1",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      role: "OWNER",
      isAdmin: false,
      tenant: {
        id: "tenant_1",
        name: "Agency",
        slug: "agency",
      },
    });
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

    render(
      React.createElement(
        AuthGuard as unknown as React.ComponentType<{
          children: (args: { user: { email: string } }) => React.ReactNode;
        }>,
        null,
        (({ user }: { user: { email: string } }) => React.createElement("div", null, user.email)) as unknown as React.ReactNode,
      ),
    );

    expect(screen.getByText("jane@example.com")).not.toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("stops infinite loading and redirects when auth request hangs", async () => {
    vi.useFakeTimers();
    getAuthTokenStateMock.mockReturnValue({ source: "workspace-demo", token: "demo-token" });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ),
    );

    render(
      React.createElement(
        AuthGuard as unknown as React.ComponentType<{
          children: (args: { user: { email: string } }) => React.ReactNode;
        }>,
        null,
        (({ user }: { user: { email: string } }) => React.createElement("div", null, user.email)) as unknown as React.ReactNode,
      ),
    );

    await act(async () => {
      vi.advanceTimersByTime(9000);
      await Promise.resolve();
    });

    expect(clearWorkspaceDemoTokenMock).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith("/login?next=%2Fprojects");
    expect(screen.getByText("Redirecting...")).not.toBeNull();
    vi.useRealTimers();
  });

  it("does not clear the normal auth token when a demo session fails", async () => {
    getAuthTokenStateMock.mockReturnValue({ source: "workspace-demo", token: "demo-token" });
    localStorage.setItem("token", "real-user-token");
    localStorage.setItem("tenantId", "real-tenant");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    render(
      React.createElement(
        AuthGuard as unknown as React.ComponentType<{
          children: (args: { user: { email: string } }) => React.ReactNode;
        }>,
        null,
        (({ user }: { user: { email: string } }) => React.createElement("div", null, user.email)) as unknown as React.ReactNode,
      ),
    );

    await waitFor(() => {
      expect(clearWorkspaceDemoTokenMock).toHaveBeenCalled();
      expect(localStorage.getItem("token")).toBe("real-user-token");
      expect(localStorage.getItem("tenantId")).toBe("real-tenant");
    });
  });
});
