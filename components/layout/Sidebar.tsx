"use client";

import { startTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FolderOpen, Shield, UserPlus, X } from "lucide-react";
import { getMessages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import type { AuthUser } from "@/lib/hooks/use-auth-guard";

const navItems = [
  { href: "/projects", key: "projects" as const, icon: FolderOpen, onlyOwnerOrPm: false, onlyAdmin: false },
  { href: "/team", key: "team" as const, icon: UserPlus, onlyOwnerOrPm: true, onlyAdmin: false },
  { href: "/admin", key: "admin" as const, icon: Shield, onlyOwnerOrPm: false, onlyAdmin: true },
];

type SidebarProps = {
  user: AuthUser;
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ user, open, onClose }: SidebarProps): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const m = getMessages();
  const isOwnerOrPm = user.role === "OWNER" || user.role === "PM";
  const visibleNavItems = user.isDemo ? navItems.filter((item) => item.key === "projects") : navItems;

  return (
    <>
        <div
          aria-hidden="true"
          onClick={onClose}
        className={cn("fixed inset-0 z-[55] bg-black/28 backdrop-blur-[3px] lg:hidden", open ? "block" : "hidden")}
        />
      <aside
        className={cn(
          "glass-sidebar sidebar-shell-macos fixed inset-y-0 left-0 z-[60] flex w-72 flex-col p-4 backdrop-blur transition-transform lg:static lg:w-64 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide glass-muted">{m.appName}</p>
            <h2 className="text-xl font-semibold">{user.tenant.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 glass-muted hover:bg-white/10 lg:hidden"
            aria-label={m.nav.closeMenu}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="sidebar-nav-group sidebar-nav-frosted sidebar-nav-macos glass-item overflow-hidden divide-y divide-white/10">
          {visibleNavItems
            .filter((item) => (!item.onlyOwnerOrPm || isOwnerOrPm) && (!item.onlyAdmin || user.isAdmin))
            .map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => {
                  onClose();
                  startTransition(() => {
                    router.push(item.href);
                  });
                }}
                className={cn(
                  "sidebar-nav-item flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition",
                  active ? "sidebar-nav-item-active" : "",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.key === "projects" ? m.nav.projects : item.key === "team" ? m.nav.team : "Admin"}
              </button>
            );
          })}
        </nav>
        <div className="glass-item glass-item-macos mt-auto p-3 text-sm">
          <p className="font-medium">
            {user.firstName} {user.lastName}
          </p>
          <p className="glass-muted">{user.role}</p>
        </div>
      </aside>
    </>
  );
}
