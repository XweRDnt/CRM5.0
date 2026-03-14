import type { AnnotationColor, AnnotationStroke, AnnotationThickness } from "./types";

type StrokeStyle = {
  color: string;
  width: number;
};

const COLOR_MAP: Record<AnnotationColor, string> = {
  red: "#ef4444",
  yellow: "#facc15",
  green: "#22c55e",
  blue: "#3b82f6",
  white: "#ffffff",
};

const THICKNESS_MAP: Record<AnnotationThickness, number> = {
  thin: 0.003,
  medium: 0.006,
  thick: 0.01,
};

const resolveStyle = (stroke: AnnotationStroke): StrokeStyle => ({
  color: COLOR_MAP[stroke.color],
  width: THICKNESS_MAP[stroke.thickness],
});

const pointsToPath = (points: AnnotationStroke["points"]): string => {
  if (points.length === 0) {
    return "";
  }
  const [first, ...rest] = points;
  const segments = rest.map((point) => `L${point.x} ${point.y}`).join(" ");
  return `M${first.x} ${first.y}${segments ? " " + segments : ""}`;
};

export const strokeToSvg = (stroke: AnnotationStroke): string => {
  const style = resolveStyle(stroke);

  switch (stroke.type) {
    case "line": {
      const [start, end] = stroke.points;
      return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${style.color}" stroke-width="${style.width}" vector-effect="non-scaling-stroke" />`;
    }
    case "arrow": {
      const [start, end] = stroke.points;
      return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${style.color}" color="${style.color}" stroke-width="${style.width}" vector-effect="non-scaling-stroke" marker-end="url(#arrowhead)" />`;
    }
    case "rect": {
      const [start, end] = stroke.points;
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const width = Math.abs(end.x - start.x);
      const height = Math.abs(end.y - start.y);
      return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="${style.color}" stroke-width="${style.width}" vector-effect="non-scaling-stroke" />`;
    }
    case "ellipse": {
      const [start, end] = stroke.points;
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${style.color}" stroke-width="${style.width}" vector-effect="non-scaling-stroke" />`;
    }
    case "freehand": {
      const path = pointsToPath(stroke.points);
      return `<path d="${path}" fill="none" stroke="${style.color}" stroke-width="${style.width}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />`;
    }
    case "text": {
      const [point] = stroke.points;
      const textValue = stroke.text ?? "";
      return `<text x="${point.x}" y="${point.y}" fill="${style.color}" font-size="0.04" font-weight="600">${textValue}</text>`;
    }
    default:
      return "";
  }
};

export const buildSvgMarkup = (strokes: AnnotationStroke[]): string => {
  const body = strokes.map((stroke) => strokeToSvg(stroke)).join("");
  const defs =
    '<defs><marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L6,3 L0,6 Z" fill="currentColor" /></marker></defs>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">${defs}${body}</svg>`;
};
