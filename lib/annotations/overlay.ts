export const getDrawingSurfaceClass = (interactive: boolean): string =>
  [
    "absolute",
    "inset-x-0",
    "top-0",
    "bottom-12",
    interactive ? "pointer-events-auto" : "pointer-events-none",
  ].join(" ");
