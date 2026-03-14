import { describe, it, expect } from "vitest";
import { getOverlaySvgProps } from "@/lib/annotations/svg";

describe("getOverlaySvgProps", () => {
  it("forces non-uniform scaling to match video aspect", () => {
    const props = getOverlaySvgProps();
    expect(props).toEqual({ viewBox: "0 0 1 1", preserveAspectRatio: "none" });
  });
});
