import { describe, it, expect, vi } from "vitest";
import { getPlaybackAction, stopAnnotationToolbarEvent } from "@/lib/annotations/interaction";

describe("stopAnnotationToolbarEvent", () => {
  it("stops propagation and prevents default", () => {
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    stopAnnotationToolbarEvent({ preventDefault, stopPropagation });
    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
  });

  it("chooses play or pause action based on current state", () => {
    expect(getPlaybackAction(true)).toBe("pause");
    expect(getPlaybackAction(false)).toBe("play");
  });
});
