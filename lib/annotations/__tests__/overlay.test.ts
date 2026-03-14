import { describe, it, expect } from "vitest";
import { getDrawingSurfaceClass } from "@/lib/annotations/overlay";

describe("getDrawingSurfaceClass", () => {
  it("reserves control bar space and toggles pointer events", () => {
    expect(getDrawingSurfaceClass(true)).toContain("bottom-12");
    expect(getDrawingSurfaceClass(true)).toContain("pointer-events-auto");
    expect(getDrawingSurfaceClass(false)).toContain("pointer-events-none");
  });
});
