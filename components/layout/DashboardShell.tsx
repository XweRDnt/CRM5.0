"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDashboardUser } from "@/components/auth/dashboard-user-context";
import { GlobalSidebar } from "@/components/layout/GlobalSidebar";
import { Header } from "@/components/layout/Header";
import { useDashboardSidebar } from "@/components/layout/dashboard-sidebar-context";

export function DashboardShell({
  children,
  pathname,
}: {
  children: ReactNode;
  pathname: string;
}): JSX.Element {
  const router = useRouter();
  const user = useDashboardUser();
  const { sidebarOpen, openSidebar, closeSidebar } = useDashboardSidebar();
  const isAllowedDemoPath =
    pathname === "/projects" ||
    /^\/projects\/[^/]+$/.test(pathname) ||
    /^\/projects\/[^/]+\/versions$/.test(pathname) ||
    /^\/projects\/[^/]+\/versions\/[^/]+$/.test(pathname);

  useEffect(() => {
    if (user.isDemo && !isAllowedDemoPath) {
      router.replace("/projects");
    }
  }, [isAllowedDemoPath, router, user.isDemo]);

  if (user.isDemo && !isAllowedDemoPath) {
    return <section className="flex min-h-screen items-center justify-center bg-neutral-100" />;
  }

  return (
    <section className="dashboard-shell isolate flex min-h-screen overflow-x-hidden">
      <GlobalSidebar user={user} open={sidebarOpen} onClose={closeSidebar} />
      <div className="relative z-0 flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
        <Header user={user} onOpenSidebar={openSidebar} />
        <main className="flex-1 p-4 lg:p-6 lg:pt-7">{children}</main>
      </div>
    </section>
  );
}
