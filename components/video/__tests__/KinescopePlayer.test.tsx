/** @vitest-environment jsdom */
import { forwardRef, useImperativeHandle } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { KinescopePlayer } from "../KinescopePlayer";

vi.mock("@kinescope/react-kinescope-player", () => {
  const Mocked = forwardRef(function MockedKinescopePlayer(
    props: { videoId: string },
    ref,
  ) {
    useImperativeHandle(ref, () => ({
      play: async () => {},
      pause: async () => {},
      seekTo: async () => {},
      getCurrentTime: async () => 12,
      getDuration: async () => 120,
    }));

    return <div data-testid="kinescope-sdk-player" data-video-id={props.videoId} />;
  });

  return {
    __esModule: true,
    default: Mocked,
  };
});

describe("KinescopePlayer", () => {
  it("renders configuration error when no source is provided", () => {
    render(<KinescopePlayer />);
    expect(screen.getByText("Kinescope video is not configured.")).toBeTruthy();
  });

  it("prefers videoId over videoUrl", () => {
    render(<KinescopePlayer videoId="video_123" videoUrl="https://kinescope.io/video_999" />);
    const sdkPlayer = screen.getByTestId("kinescope-sdk-player");
    expect(sdkPlayer.getAttribute("data-video-id")).toBe("video_123");
  });

  it("extracts videoId from kinescope URL when explicit id is missing", () => {
    render(<KinescopePlayer videoUrl="https://kinescope.io/video_777" />);
    const sdkPlayer = screen.getByTestId("kinescope-sdk-player");
    expect(sdkPlayer.getAttribute("data-video-id")).toBe("video_777");
  });
});
