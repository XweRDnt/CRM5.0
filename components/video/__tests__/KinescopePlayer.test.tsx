/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { KinescopePlayer } from "../KinescopePlayer";

describe("KinescopePlayer", () => {
  it("renders configuration error when no source is provided", () => {
    render(<KinescopePlayer />);
    expect(screen.getByText("Kinescope video is not configured.")).toBeTruthy();
  });

  it("prefers videoId over videoUrl to avoid non-embed URLs in iframe", () => {
    const { container } = render(
      <KinescopePlayer
        videoId="video_123"
        videoUrl="https://cdn.example.com/video.m3u8"
      />,
    );

    const iframe = container.querySelector("iframe");
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute("src")).toBe("https://kinescope.io/video_123");
  });

  it("sets iframe title for accessibility", () => {
    const { container } = render(<KinescopePlayer videoId="video_123" />);
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("title")).toBe("Kinescope video player");
  });
});
