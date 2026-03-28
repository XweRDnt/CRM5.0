export function getVersionDetailLayoutMode(isDesktopViewport: boolean): {
  showMobileLayout: boolean;
  showDesktopLayout: boolean;
} {
  return {
    showMobileLayout: !isDesktopViewport,
    showDesktopLayout: isDesktopViewport,
  };
}
