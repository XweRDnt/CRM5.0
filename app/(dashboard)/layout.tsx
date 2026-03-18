"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }): JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const hideHeader = /^\/projects\/[^/]+\/versions\/[^/]+$/.test(pathname);

  return (
    <AuthGuard>
      {({ user }) => (
        <section className="dashboard-shell flex min-h-screen overflow-x-hidden">
          <Sidebar user={user} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
            {hideHeader ? null : <Header user={user} onOpenSidebar={() => setSidebarOpen(true)} />}
            <main className={hideHeader ? "flex-1 p-0" : "flex-1 p-4 lg:p-6 lg:pt-7"}>{children}</main>
          </div>
        </section>
      )}
    </AuthGuard>
  );
}
