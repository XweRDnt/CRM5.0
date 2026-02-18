"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function MobileSidebar({ isOpen, onClose, children }: MobileSidebarProps): JSX.Element {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <>
      <div
        data-testid="overlay"
        aria-hidden="true"
        onClick={onClose}
        className={cn("fixed inset-0 z-40 bg-black/50 transition-opacity", isOpen ? "opacity-100" : "pointer-events-none opacity-0")}
      />
      <aside
        aria-hidden={!isOpen}
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-64 transform bg-white shadow-lg transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {children}
      </aside>
    </>
  );
}
