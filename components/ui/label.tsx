import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>): JSX.Element {
  return <label className={cn("text-sm font-medium text-neutral-700", className)} {...props} />;
}
