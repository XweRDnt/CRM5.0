/** @vitest-environment jsdom */
import { forwardRef, useImperativeHandle } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { KinescopePlayer } from "../KinescopePlayer";

vi.mock("@kinescope/react-kinescope-player", () => {
  const Mocked = forwardRef(function MockedKinescopePlayer(
    props: { videoId: string; playsInline?: boolean },
    ref,
  ) {
    useImperativeHandle(ref, () => ({
      play: async () => {},
      pause: async () => {},
      seekTo: async () => {},
      getCurrentTime: async () => 12,
      getDuration: async () => 120,
    }));

    return (
      <div
        data-testid="kinescope-sdk-player"
        data-video-id={props.videoId}
        data-plays-inline={String(Boolean(props.playsInline))}
      />
    );
  });

  return {
    __esModule: true,
    default: Mocked,
  };
});

describe("KinescopePlayer", () => {
  const originalUserAgent = navigator.userAgent;

  const setUserAgent = (userAgent: string): void => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: userAgent,
      configurable: true,
    });
  };

  afterEach(() => {
    setUserAgent(originalUserAgent);
  });

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

  it("keeps inline playback for non-android browsers", () => {
    setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    render(<KinescopePlayer videoId="video_123" />);
    const sdkPlayer = screen.getByTestId("kinescope-sdk-player");
    expect(sdkPlayer.getAttribute("data-plays-inline")).toBe("true");
  });

  it("disables inline playback on Android to allow native fullscreen", () => {
    setUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8)");
    render(<KinescopePlayer videoId="video_123" />);
    const sdkPlayer = screen.getByTestId("kinescope-sdk-player");
    expect(sdkPlayer.getAttribute("data-plays-inline")).toBe("false");
  });
});
