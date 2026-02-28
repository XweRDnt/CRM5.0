"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, Users, UserPlus, X } from "lucide-react";
import { getMessages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import type { AuthUser } from "@/lib/hooks/use-auth-guard";

const navItems = [
  { href: "/projects", key: "projects" as const, icon: FolderOpen, onlyOwnerOrPm: false },
  { href: "/clients", key: "clients" as const, icon: Users, onlyOwnerOrPm: true },
  { href: "/team", key: "team" as const, icon: UserPlus, onlyOwnerOrPm: true },
];

type SidebarProps = {
  user: AuthUser;
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ user, open, onClose }: SidebarProps): JSX.Element {
  const pathname = usePathname();
  const m = getMessages();
  const isOwnerOrPm = user.role === "OWNER" || user.role === "PM";

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn("fixed inset-0 z-30 bg-black/40 lg:hidden", open ? "block" : "hidden")}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-neutral-200 bg-white/90 p-4 backdrop-blur transition-transform lg:static lg:w-64 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{m.appName}</p>
            <h2 className="text-xl font-semibold text-neutral-900">{user.tenant.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 lg:hidden"
            aria-label={m.nav.closeMenu}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="sidebar-nav-group overflow-hidden border border-neutral-200 divide-y divide-neutral-200">
          {navItems
            .filter((item) => !item.onlyOwnerOrPm || isOwnerOrPm)
            .map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "sidebar-nav-item flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition",
                  active ? "sidebar-nav-item-active bg-blue-100 text-blue-700" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                )}
                >
                <Icon className="h-4 w-4" />
                {item.key === "projects" ? m.nav.projects : item.key === "clients" ? m.nav.clients : m.nav.team}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
          <p className="font-medium text-neutral-900">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-neutral-500">{user.role}</p>
        </div>
      </aside>
    </>
  );
}
