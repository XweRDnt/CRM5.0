"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import type { AuthUser } from "@/lib/hooks/use-auth-guard";

type VersionDetailMobileSidebarProps = {
  user: AuthUser;
  open: boolean;
  onClose: () => void;
};

export function VersionDetailMobileSidebar({ user, open, onClose }: VersionDetailMobileSidebarProps): JSX.Element {
  return <Sidebar user={user} open={open} onClose={onClose} />;
}
