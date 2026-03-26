/** @vitest-environment jsdom */

import React from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthGuard } from "@/components/auth/auth-guard";

const replaceMock = vi.fn();
const getAuthTokenMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects",
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("swr", () => ({
  mutate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/utils/client-api", () => ({
  clearWorkspaceDemoToken: vi.fn(),
  getAuthToken: () => getAuthTokenMock(),
}));

describe("useAuthGuard", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    getAuthTokenMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("stops infinite loading and redirects when auth request hangs", async () => {
    vi.useFakeTimers();
    getAuthTokenMock.mockReturnValue("demo-token");
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

    expect(replaceMock).toHaveBeenCalledWith("/login?next=%2Fprojects");
    expect(screen.getByText("Redirecting...")).not.toBeNull();
    vi.useRealTimers();
  });
});
