import { beforeEach, describe, expect, it, vi } from "vitest";

const isWorkspaceDemoTokenMock = vi.fn<(token: string) => boolean>();

vi.mock("@/lib/utils/workspace-demo-token", () => ({
  isWorkspaceDemoToken: (token: string) => isWorkspaceDemoTokenMock(token),
}));

import { GET } from "@/app/workspace-demo/[token]/route";

describe("WorkspaceDemoPage", () => {
  beforeEach(() => {
    isWorkspaceDemoTokenMock.mockReset();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("returns notFound for an invalid workspace demo token", async () => {
    isWorkspaceDemoTokenMock.mockReturnValue(false);

    const response = await GET(new Request("http://localhost/workspace-demo/wrong-token"), {
      params: Promise.resolve({ token: "wrong-token" }),
    });

    expect(response.status).toBe(404);
  });

  it("stores the demo token cookie and redirects to the real dashboard", async () => {
    isWorkspaceDemoTokenMock.mockReturnValue(true);

    const response = await GET(new Request("http://localhost/workspace-demo/workspace-demo-secret"), {
      params: Promise.resolve({ token: "workspace-demo-secret" }),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/projects?workspaceDemoToken=workspace-demo-secret");
    expect(response.headers.get("set-cookie")).toContain("workspaceDemoToken=workspace-demo-secret");
  });

  it("does not depend on NEXT_PUBLIC_APP_URL for redirects", async () => {
    isWorkspaceDemoTokenMock.mockReturnValue(true);
    process.env.NEXT_PUBLIC_APP_URL = "https://\u043f\u0440\u0430\u0432\u043a\u0438.xyz";

    const response = await GET(new Request("https://xn--80aeshwg.xyz/workspace-demo/workspace-demo-secret"), {
      params: Promise.resolve({ token: "workspace-demo-secret" }),
    });

    expect(response.headers.get("location")).toBe("/projects?workspaceDemoToken=workspace-demo-secret");
  });
});
