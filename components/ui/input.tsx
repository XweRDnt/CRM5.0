import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return (
    <input
      className={cn(
        "ui-input flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none ring-offset-2 transition focus:ring-2 focus:ring-blue-500",
        className,
      )}
      {...props}
    />
  );
}
