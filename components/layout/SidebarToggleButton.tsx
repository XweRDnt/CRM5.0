"use client";

import { Menu } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type SidebarToggleButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function SidebarToggleButton({ className, ...props }: SidebarToggleButtonProps): JSX.Element {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label="Открыть меню"
      className={cn(
        "h-10 w-10 shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-0 text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-white/[0.08] lg:hidden",
        className,
      )}
      {...props}
    >
      <Menu className="h-4 w-4" />
    </Button>
  );
}
