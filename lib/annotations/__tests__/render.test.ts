import { describe, it, expect } from "vitest";
import { strokeToSvg } from "@/lib/annotations/render";
import { buildSvgMarkup } from "@/lib/annotations/render";

describe("strokeToSvg", () => {
  it("renders line as svg line", () => {
    const markup = strokeToSvg({
      type: "line",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      color: "red",
      thickness: "thin",
    });
    expect(markup).toContain("<line");
  });

  it("maps thickness tokens to pixel stroke width", () => {
    const markup = strokeToSvg({
      type: "line",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      color: "red",
      thickness: "thin",
    });
    expect(markup).toContain('stroke-width="3"');
  });

  it("renders svg markup with non-uniform scaling", () => {
    const markup = buildSvgMarkup([
      {
        type: "line",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        color: "red",
        thickness: "thin",
      },
    ]);
    expect(markup).toContain('preserveAspectRatio="none"');
  });
});
