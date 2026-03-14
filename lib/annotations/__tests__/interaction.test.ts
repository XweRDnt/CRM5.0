import { describe, it, expect, vi } from "vitest";
import { getAnnotationToggle, getPlaybackAction, stopAnnotationToolbarEvent } from "@/lib/annotations/interaction";

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

  it("toggles annotation mode and indicates pause on enable", () => {
    expect(getAnnotationToggle(false)).toEqual({ nextEnabled: true, shouldPause: true });
    expect(getAnnotationToggle(true)).toEqual({ nextEnabled: false, shouldPause: false });
  });
});
