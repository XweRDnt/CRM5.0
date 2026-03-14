type StopEvent = {
  preventDefault?: () => void;
  stopPropagation?: () => void;
};

export type PlaybackAction = "play" | "pause";

export const getPlaybackAction = (isPlaying: boolean): PlaybackAction => (isPlaying ? "pause" : "play");

export type AnnotationToggleResult = { nextEnabled: boolean; shouldPause: boolean };

export const getAnnotationToggle = (isEnabled: boolean): AnnotationToggleResult =>
  isEnabled ? { nextEnabled: false, shouldPause: false } : { nextEnabled: true, shouldPause: true };

export const stopAnnotationToolbarEvent = (event: StopEvent): void => {
  event.preventDefault?.();
  event.stopPropagation?.();
};
