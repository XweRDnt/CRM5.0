import { describe, expect, it } from "vitest";

import { isDemoToken } from "@/lib/utils/demo-token";

describe("isDemoToken", () => {
  it("returns true only for the configured demo portal token", () => {
    process.env.DEMO_PORTAL_TOKEN = "demo-secret";

    expect(isDemoToken("demo-secret")).toBe(true);
    expect(isDemoToken("other-token")).toBe(false);
  });

  it("returns false when the env token is missing", () => {
    delete process.env.DEMO_PORTAL_TOKEN;

    expect(isDemoToken("demo-secret")).toBe(false);
  });
});
