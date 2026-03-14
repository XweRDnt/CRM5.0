import { describe, it, expect, vi } from "vitest";
import { stopAnnotationToolbarEvent } from "@/lib/annotations/interaction";

describe("stopAnnotationToolbarEvent", () => {
  it("stops propagation and prevents default", () => {
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    stopAnnotationToolbarEvent({ preventDefault, stopPropagation });
    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
  });
});
