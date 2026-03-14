type RectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const normalizeClientPoint = (
  clientX: number,
  clientY: number,
  rect: RectLike,
): Point | null => {
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    x: clamp01((clientX - rect.left) / rect.width),
    y: clamp01((clientY - rect.top) / rect.height),
  };
};
