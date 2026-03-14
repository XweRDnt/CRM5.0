import { describe, it, expect } from "vitest";
import { normalizeClientPoint } from "@/lib/annotations/coords";

describe("normalizeClientPoint", () => {
  it("normalizes client coordinates using rect origin and size", () => {
    const point = normalizeClientPoint(150, 100, {
      left: 100,
      top: 50,
      width: 200,
      height: 100,
    });
    expect(point).toEqual({ x: 0.25, y: 0.5 });
  });
});
