export type AnnotationType = "arrow" | "rect" | "ellipse" | "line" | "freehand" | "text";

export type AnnotationColor = "red" | "yellow" | "green" | "blue" | "white";

export type AnnotationThickness = "thin" | "medium" | "thick";

export type AnnotationPoint = {
  x: number;
  y: number;
};

export type AnnotationStroke = {
  type: AnnotationType;
  points: AnnotationPoint[];
  color: AnnotationColor;
  thickness: AnnotationThickness;
  text?: string;
};

export type AnnotationData = {
  version: 1;
  strokes: AnnotationStroke[];
};
