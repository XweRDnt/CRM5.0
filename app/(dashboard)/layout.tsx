"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardUserProvider } from "@/components/auth/dashboard-user-context";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { DashboardSidebarProvider } from "@/components/layout/dashboard-sidebar-context";

export default function DashboardLayout({ children }: { children: ReactNode }): JSX.Element {
  const pathname = usePathname();

  return (
    <AuthGuard>
      {({ user }) => (
        <DashboardUserProvider user={user}>
          <DashboardSidebarProvider>
            <DashboardShell pathname={pathname}>
              {children}
            </DashboardShell>
          </DashboardSidebarProvider>
        </DashboardUserProvider>
      )}
    </AuthGuard>
  );
}
