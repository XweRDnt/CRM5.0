"use client";

import { FolderOpen, Shield, UserPlus, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { getMessages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import type { AuthUser } from "@/lib/hooks/use-auth-guard";

const navItems = [
  { href: "/projects", key: "projects" as const, icon: FolderOpen, onlyOwnerOrPm: false, onlyAdmin: false },
  { href: "/team", key: "team" as const, icon: UserPlus, onlyOwnerOrPm: true, onlyAdmin: false },
  { href: "/admin", key: "admin" as const, icon: Shield, onlyOwnerOrPm: false, onlyAdmin: true },
];

type GlobalSidebarProps = {
  user: AuthUser;
  open: boolean;
  onClose: () => void;
};

export function GlobalSidebar({ user, open, onClose }: GlobalSidebarProps): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const m = getMessages();
  const isOwnerOrPm = user.role === "OWNER" || user.role === "PM";
  const visibleNavItems = user.isDemo ? navItems.filter((item) => item.key === "projects") : navItems;

  const navigation = visibleNavItems
    .filter((item) => (!item.onlyOwnerOrPm || isOwnerOrPm) && (!item.onlyAdmin || user.isAdmin))
    .map((item) => {
      const Icon = item.icon;
      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

      return (
        <button
          key={item.href}
          type="button"
          onClick={() => {
            router.push(item.href);
            onClose();
          }}
          className={cn(
            "sidebar-nav-item flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition",
            active ? "sidebar-nav-item-active" : "",
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span>{item.key === "projects" ? m.nav.projects : item.key === "team" ? m.nav.team : "Admin"}</span>
        </button>
      );
    });

  const sidebarBody = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] glass-muted">{m.appName}</p>
          <h2 className="mt-2 truncate text-xl font-semibold text-white">{user.tenant.name}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={m.nav.closeMenu}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/75 hover:bg-white/[0.08] lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-2">{navigation}</nav>

      <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.05] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <p className="truncate text-sm font-semibold text-white">
          {user.firstName} {user.lastName}
        </p>
        <p className="mt-1 text-xs uppercase tracking-[0.2em] glass-muted">{user.role}</p>
      </div>
    </>
  );

  return (
    <>
      <div className={cn("fixed inset-0 z-[80] lg:hidden", open ? "block" : "hidden")}>
        <div className="flex h-full">
          <aside
            role="complementary"
            className="glass-sidebar flex h-full w-[min(86vw,320px)] max-w-[320px] shrink-0 flex-col border-r border-white/10 px-4 py-5 backdrop-blur-2xl"
          >
            {sidebarBody}
          </aside>
          <button
            type="button"
            aria-label={m.nav.closeMenu}
            onClick={onClose}
            className="min-w-0 flex-1 bg-slate-950/45 backdrop-blur-[2px]"
          />
        </div>
      </div>

      <aside
        role="complementary"
        className="glass-sidebar hidden min-h-screen shrink-0 flex-col border-r border-white/10 px-5 py-6 backdrop-blur-2xl lg:flex lg:w-[280px]"
      >
        {sidebarBody}
      </aside>
    </>
  );
}
