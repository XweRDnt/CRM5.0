"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const adminTabs = [
  { href: "/admin", label: "Обзор" },
  { href: "/admin/workspaces", label: "Workspace" },
  { href: "/admin/plans", label: "Тарифы" },
];

export function AdminTopNav(): JSX.Element {
  const pathname = usePathname();

  return (
    <nav className="-mx-1 overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 backdrop-blur-xl">
        {adminTabs.map((tab) => {
          const active = tab.href === "/admin" ? pathname === "/admin" : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              data-active={active ? "true" : "false"}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                active
                  ? "bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "text-slate-300 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
