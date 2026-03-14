type StopEvent = {
  preventDefault?: () => void;
  stopPropagation?: () => void;
};

export type PlaybackAction = "play" | "pause";

export const getPlaybackAction = (isPlaying: boolean): PlaybackAction => (isPlaying ? "pause" : "play");

export const stopAnnotationToolbarEvent = (event: StopEvent): void => {
  event.preventDefault?.();
  event.stopPropagation?.();
};
