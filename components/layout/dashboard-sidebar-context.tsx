"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type DashboardSidebarContextValue = {
  sidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
};

const DashboardSidebarContext = createContext<DashboardSidebarContextValue | null>(null);

export function DashboardSidebarProvider({ children }: { children: ReactNode }): JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const value = useMemo<DashboardSidebarContextValue>(
    () => ({
      sidebarOpen,
      openSidebar: () => setSidebarOpen(true),
      closeSidebar: () => setSidebarOpen(false),
      setSidebarOpen,
    }),
    [sidebarOpen],
  );

  return <DashboardSidebarContext.Provider value={value}>{children}</DashboardSidebarContext.Provider>;
}

export function useDashboardSidebar(): DashboardSidebarContextValue {
  const value = useContext(DashboardSidebarContext);

  if (!value) {
    throw new Error("useDashboardSidebar must be used within DashboardSidebarProvider");
  }

  return value;
}
