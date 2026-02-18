"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }): JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthGuard>
      {({ user }) => (
        <section className="flex min-h-screen bg-neutral-100">
          <Sidebar user={user} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex min-h-screen flex-1 flex-col">
            <Header user={user} onOpenSidebar={() => setSidebarOpen(true)} />
            <main className="flex-1 p-4 lg:p-6 lg:pt-7">{children}</main>
          </div>
        </section>
      )}
    </AuthGuard>
  );
}
