import { describe, expect, it } from "vitest";

import { isWorkspaceDemoToken } from "@/lib/utils/workspace-demo-token";

describe("isWorkspaceDemoToken", () => {
  it("returns true only for the configured workspace demo token", () => {
    process.env.DEMO_WORKSPACE_TOKEN = "workspace-demo-secret";

    expect(isWorkspaceDemoToken("workspace-demo-secret")).toBe(true);
    expect(isWorkspaceDemoToken("other-token")).toBe(false);
  });

  it("returns false when the demo token is not configured", () => {
    delete process.env.DEMO_WORKSPACE_TOKEN;

    expect(isWorkspaceDemoToken("workspace-demo-secret")).toBe(false);
  });
});
