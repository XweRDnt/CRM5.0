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

  it("falls back to the workspace demo token from the URL when the cookie is not available yet", () => {
    window.history.replaceState({}, "", "/projects?workspaceDemoToken=url-demo-token");

    expect(getAuthToken()).toBe("url-demo-token");
    expect(document.cookie).toContain("workspaceDemoToken=url-demo-token");
  });
});
