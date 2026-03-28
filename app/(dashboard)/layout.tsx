"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardUserProvider } from "@/components/auth/dashboard-user-context";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { DashboardSidebarProvider, useDashboardSidebar } from "@/components/layout/dashboard-sidebar-context";
import type { AuthUser } from "@/lib/hooks/use-auth-guard";

function DashboardShell({
  children,
  user,
  pathname,
}: {
  children: ReactNode;
  user: AuthUser;
  pathname: string;
}): JSX.Element {
  const router = useRouter();
  const { sidebarOpen, openSidebar, closeSidebar } = useDashboardSidebar();
  const hideHeader = /^\/projects\/[^/]+\/versions\/[^/]+$/.test(pathname);
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
    <section className="dashboard-shell flex min-h-screen overflow-x-hidden">
      <Sidebar user={user} open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
        {hideHeader ? null : <Header user={user} onOpenSidebar={openSidebar} />}
        <main className={hideHeader ? "flex-1 p-0" : "flex-1 p-4 lg:p-6 lg:pt-7"}>{children}</main>
      </div>
    </section>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }): JSX.Element {
  const pathname = usePathname();

  return (
    <AuthGuard>
      {({ user }) => (
        <DashboardUserProvider user={user}>
          <DashboardSidebarProvider>
            <DashboardShell user={user} pathname={pathname}>
              {children}
            </DashboardShell>
          </DashboardSidebarProvider>
        </DashboardUserProvider>
      )}
    </AuthGuard>
  );
}
