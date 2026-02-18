"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type AppTheme = "light" | "dark";

const THEME_STORAGE_KEY = "app-theme";

function isMarketingRoute(pathname: string): boolean {
  return pathname === "/";
}

export function AppThemeShell({ children }: { children: React.ReactNode }): JSX.Element {
  const pathname = usePathname();
  const [theme, setTheme] = useState<AppTheme>(() => {
    if (typeof document !== "undefined") {
      const domTheme = document.documentElement.dataset.appTheme;
      if (domTheme === "dark") {
        return "dark";
      }
    }

    if (typeof window !== "undefined") {
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      return savedTheme === "dark" ? "dark" : "light";
    }

    return "light";
  });

  useEffect(() => {
    document.documentElement.dataset.appTheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.cookie = `app-theme=${theme}; path=/; max-age=31536000; samesite=lax`;
  }, [theme]);

  if (isMarketingRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <div data-app-shell="ios" data-theme={theme} className="app-ios-shell" suppressHydrationWarning>
      <button
        type="button"
        onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
        className="app-theme-toggle"
        aria-label="Toggle app theme"
      >
        Тема
      </button>
      <div className="app-ios-shell-content">{children}</div>
    </div>
  );
}
