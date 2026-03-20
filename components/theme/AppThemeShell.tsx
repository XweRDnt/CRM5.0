"use client";

import { usePathname } from "next/navigation";

function isMarketingRoute(pathname: string): boolean {
  return pathname === "/";
}

export function AppThemeShell({ children }: { children: React.ReactNode }): JSX.Element {
  const pathname = usePathname();

  if (isMarketingRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <div data-app-shell="ios" className="app-ios-shell" suppressHydrationWarning>
      <div className="app-ios-shell-content">{children}</div>
    </div>
  );
}
