type StopEvent = {
  preventDefault?: () => void;
  stopPropagation?: () => void;
};

export const stopAnnotationToolbarEvent = (event: StopEvent): void => {
  event.preventDefault?.();
  event.stopPropagation?.();
};
