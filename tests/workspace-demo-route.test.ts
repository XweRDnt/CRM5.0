import { beforeEach, describe, expect, it, vi } from "vitest";

const notFoundMock = vi.fn();
const isWorkspaceDemoTokenMock = vi.fn<(token: string) => boolean>();

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}));

vi.mock("@/lib/utils/workspace-demo-token", () => ({
  isWorkspaceDemoToken: (token: string) => isWorkspaceDemoTokenMock(token),
}));

import WorkspaceDemoPage from "@/app/workspace-demo/[token]/page";

describe("WorkspaceDemoPage", () => {
  beforeEach(() => {
    notFoundMock.mockReset();
    isWorkspaceDemoTokenMock.mockReset();
  });

  it("returns notFound for an invalid workspace demo token", async () => {
    isWorkspaceDemoTokenMock.mockReturnValue(false);

    await WorkspaceDemoPage({ params: Promise.resolve({ token: "wrong-token" }) });

    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("renders the workspace demo page for a valid token", async () => {
    isWorkspaceDemoTokenMock.mockReturnValue(true);

    const result = await WorkspaceDemoPage({ params: Promise.resolve({ token: "workspace-demo-secret" }) });

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });
});
