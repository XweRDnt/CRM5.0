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
      <div className="inline-flex min-w-full gap-2 rounded-2xl border border-neutral-200/80 bg-white/85 p-1.5 shadow-sm">
        {adminTabs.map((tab) => {
          const active = tab.href === "/admin" ? pathname === "/admin" : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              data-active={active ? "true" : "false"}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                active ? "bg-neutral-900 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
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
