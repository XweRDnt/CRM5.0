import { describe, expect, it } from "vitest";

import { getVersionDetailLayoutMode } from "@/lib/utils/version-detail-layout";

describe("getVersionDetailLayoutMode", () => {
  it("renders only the mobile layout on mobile viewports", () => {
    expect(getVersionDetailLayoutMode(false)).toEqual({
      showDesktopLayout: false,
      showMobileLayout: true,
    });
  });

  it("renders only the desktop layout on desktop viewports", () => {
    expect(getVersionDetailLayoutMode(true)).toEqual({
      showDesktopLayout: true,
      showMobileLayout: false,
    });
  });
});
