import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();
const notFoundMock = vi.fn();
const isDemoTokenMock = vi.fn<(token: string) => boolean>();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
  notFound: () => notFoundMock(),
}));

vi.mock("@/lib/utils/demo-token", () => ({
  isDemoToken: (token: string) => isDemoTokenMock(token),
}));

import DemoRedirectPage from "@/app/demo/[token]/page";

describe("DemoRedirectPage", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    notFoundMock.mockReset();
    isDemoTokenMock.mockReset();
  });

  it("returns notFound for an invalid demo token", async () => {
    isDemoTokenMock.mockReturnValue(false);

    await DemoRedirectPage({ params: Promise.resolve({ token: "wrong-token" }) });

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects a valid token to the client portal in readonly mode", async () => {
    isDemoTokenMock.mockReturnValue(true);

    await DemoRedirectPage({ params: Promise.resolve({ token: "demo-secret" }) });

    expect(redirectMock).toHaveBeenCalledWith("/client-portal/demo-secret?readonly=true");
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
