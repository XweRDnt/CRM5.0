import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();
const notFoundMock = vi.fn();
const setCookieMock = vi.fn();
const isWorkspaceDemoTokenMock = vi.fn<(token: string) => boolean>();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
  notFound: () => {
    notFoundMock();
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (...args: unknown[]) => setCookieMock(...args),
  }),
}));

vi.mock("@/lib/utils/workspace-demo-token", () => ({
  isWorkspaceDemoToken: (token: string) => isWorkspaceDemoTokenMock(token),
}));

import WorkspaceDemoPage from "@/app/workspace-demo/[token]/page";

describe("WorkspaceDemoPage", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    notFoundMock.mockReset();
    setCookieMock.mockReset();
    isWorkspaceDemoTokenMock.mockReset();
  });

  it("returns notFound for an invalid workspace demo token", async () => {
    isWorkspaceDemoTokenMock.mockReturnValue(false);

    await expect(WorkspaceDemoPage({ params: Promise.resolve({ token: "wrong-token" }) })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(setCookieMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("stores the demo token cookie and redirects to the real dashboard", async () => {
    isWorkspaceDemoTokenMock.mockReturnValue(true);

    await WorkspaceDemoPage({ params: Promise.resolve({ token: "workspace-demo-secret" }) });

    expect(setCookieMock).toHaveBeenCalledWith(
      "workspaceDemoToken",
      "workspace-demo-secret",
      expect.objectContaining({
        path: "/",
        sameSite: "lax",
      }),
    );
    expect(redirectMock).toHaveBeenCalledWith("/projects");
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
