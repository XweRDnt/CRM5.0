import { describe, it, expect } from "vitest";
import { getAnnotationPlaybackPolicy } from "@/lib/annotations/behavior";

describe("getAnnotationPlaybackPolicy", () => {
  it("hides annotations on play and pauses on comment select", () => {
    const policy = getAnnotationPlaybackPolicy();
    expect(policy).toEqual({ hideOnPlay: true, pauseOnCommentSelect: true });
  });
});
