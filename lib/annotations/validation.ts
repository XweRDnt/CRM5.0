import type { AnnotationColor, AnnotationData, AnnotationPoint, AnnotationStroke, AnnotationThickness, AnnotationType } from "./types";

type ValidationResult = { ok: true } | { ok: false; error: string };

const VALID_TYPES: AnnotationType[] = ["arrow", "rect", "ellipse", "line", "freehand", "text"];
const VALID_COLORS: AnnotationColor[] = ["red", "yellow", "green", "blue", "white"];
const VALID_THICKNESSES: AnnotationThickness[] = ["thin", "medium", "thick"];

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isPoint = (value: unknown): value is AnnotationPoint => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const point = value as AnnotationPoint;
  return isNumber(point.x) && isNumber(point.y);
};

const isPointInRange = (point: AnnotationPoint): boolean => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;

const minPointsForType = (type: AnnotationType): number => {
  if (type === "text" || type === "freehand") {
    return 1;
  }
  return 2;
};

const validateStroke = (stroke: AnnotationStroke, index: number): ValidationResult => {
  if (!VALID_TYPES.includes(stroke.type)) {
    return { ok: false, error: `Stroke ${index} has invalid type` };
  }
  if (!VALID_COLORS.includes(stroke.color)) {
    return { ok: false, error: `Stroke ${index} has invalid color` };
  }
  if (!VALID_THICKNESSES.includes(stroke.thickness)) {
    return { ok: false, error: `Stroke ${index} has invalid thickness` };
  }
  if (!Array.isArray(stroke.points) || stroke.points.length < minPointsForType(stroke.type)) {
    return { ok: false, error: `Stroke ${index} has invalid points` };
  }

  for (const point of stroke.points) {
    if (!isPoint(point)) {
      return { ok: false, error: `Stroke ${index} has invalid point` };
    }
    if (!isPointInRange(point)) {
      return { ok: false, error: `Stroke ${index} has point out of range` };
    }
  }

  if (stroke.type === "text") {
    if (typeof stroke.text !== "string" || stroke.text.trim().length === 0) {
      return { ok: false, error: `Stroke ${index} text is required` };
    }
  }

  return { ok: true };
};

export const validateAnnotationData = (value: unknown): ValidationResult => {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Annotation data must be an object" };
  }

  const data = value as AnnotationData;
  if (data.version !== 1) {
    return { ok: false, error: "Annotation data version is invalid" };
  }

  if (!Array.isArray(data.strokes)) {
    return { ok: false, error: "Annotation data strokes must be an array" };
  }

  for (let i = 0; i < data.strokes.length; i += 1) {
    const stroke = data.strokes[i];
    const result = validateStroke(stroke, i);
    if (!result.ok) {
      return result;
    }
  }

  return { ok: true };
};
