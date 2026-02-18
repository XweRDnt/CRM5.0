import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element {
  return (
    <textarea
      className={cn(
        "ui-textarea min-h-20 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none ring-offset-2 transition focus:ring-2 focus:ring-blue-500",
        className,
      )}
      {...props}
    />
  );
}
