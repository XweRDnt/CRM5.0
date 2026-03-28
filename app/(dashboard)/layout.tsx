"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardUserProvider } from "@/components/auth/dashboard-user-context";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import type { AuthUser } from "@/lib/hooks/use-auth-guard";

function DashboardShell({
  children,
  user,
  pathname,
  sidebarOpen,
  setSidebarOpen,
}: {
  children: ReactNode;
  user: AuthUser;
  pathname: string;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}): JSX.Element {
  const router = useRouter();
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
      <Sidebar user={user} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
        {hideHeader ? null : <Header user={user} onOpenSidebar={() => setSidebarOpen(true)} />}
        <main className={hideHeader ? "flex-1 p-0" : "flex-1 p-4 lg:p-6 lg:pt-7"}>{children}</main>
      </div>
    </section>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }): JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <AuthGuard>
      {({ user }) => (
        <DashboardUserProvider user={user}>
          <DashboardShell user={user} pathname={pathname} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}>
            {children}
          </DashboardShell>
        </DashboardUserProvider>
      )}
    </AuthGuard>
  );
}
