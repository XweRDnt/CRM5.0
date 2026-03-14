import { describe, it, expect } from "vitest";
import { validateAnnotationData } from "@/lib/annotations/validation";

describe("validateAnnotationData", () => {
  it("accepts valid stroke data", () => {
    const result = validateAnnotationData({
      version: 1,
      strokes: [
        { type: "line", points: [{ x: 0.1, y: 0.2 }, { x: 0.9, y: 0.8 }], color: "red", thickness: "thin" },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects points outside 0..1", () => {
    const result = validateAnnotationData({
      version: 1,
      strokes: [
        { type: "rect", points: [{ x: -0.1, y: 0 }, { x: 1, y: 1 }], color: "blue", thickness: "medium" },
      ],
    });
    expect(result.ok).toBe(false);
  });
});
