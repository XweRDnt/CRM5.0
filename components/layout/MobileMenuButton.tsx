"use client";

import { Menu } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type MobileMenuButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function MobileMenuButton({ className, ...props }: MobileMenuButtonProps): JSX.Element {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label="Открыть меню"
      className={cn("h-9 w-9 shrink-0 px-0 lg:hidden", className)}
      {...props}
    >
      <Menu className="h-4 w-4" />
    </Button>
  );
}
