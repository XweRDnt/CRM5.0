/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";

import { clearWorkspaceDemoToken, getAuthToken, getAuthTokenState } from "@/lib/utils/client-api";

describe("client api demo token handling", () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearWorkspaceDemoToken();
    window.history.replaceState({}, "", "/projects");
  });

  it("prefers the workspace demo token stored in sessionStorage for the current tab", () => {
    localStorage.setItem("token", "real-user-token");
    sessionStorage.setItem("workspaceDemoToken", "demo-token");

    expect(getAuthToken()).toBe("demo-token");
    expect(getAuthTokenState()).toEqual({ source: "workspace-demo", token: "demo-token" });
  });

  it("persists the workspace demo token from the URL into sessionStorage", () => {
    window.history.replaceState({}, "", "/projects?workspaceDemoToken=url-demo-token");

    expect(getAuthToken()).toBe("url-demo-token");
    expect(sessionStorage.getItem("workspaceDemoToken")).toBe("url-demo-token");
  });

  it("ignores the legacy workspace demo cookie so demo does not take over the whole browser session", () => {
    localStorage.setItem("token", "real-user-token");
    document.cookie = "workspaceDemoToken=stale-demo-cookie; path=/";

    expect(getAuthToken()).toBe("real-user-token");
    expect(getAuthTokenState()).toEqual({ source: "auth", token: "real-user-token" });
  });

  it("backfills the auth cookie from a legacy localStorage session", () => {
    document.cookie = "authToken=; Max-Age=0; path=/";
    localStorage.setItem("token", "real-user-token");

    expect(document.cookie).not.toContain("authToken=real-user-token");
    expect(getAuthTokenState()).toEqual({ source: "auth", token: "real-user-token" });
    expect(document.cookie).toContain("authToken=real-user-token");
  });
});
