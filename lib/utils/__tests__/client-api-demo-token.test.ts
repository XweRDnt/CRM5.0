/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";

import { clearWorkspaceDemoToken, getAuthToken } from "@/lib/utils/client-api";

describe("client api demo token handling", () => {
  afterEach(() => {
    localStorage.clear();
    clearWorkspaceDemoToken();
  });

  it("prefers the workspace demo token cookie over the normal auth token", () => {
    localStorage.setItem("token", "real-user-token");
    document.cookie = "workspaceDemoToken=demo-token; path=/";

    expect(getAuthToken()).toBe("demo-token");
  });
});
