import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: string;
  text?: string;
  className?: string;
}

const sizeClasses: Record<NonNullable<LoadingSpinnerProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function LoadingSpinner({
  size = "md",
  color = "text-neutral-600",
  text,
  className,
}: LoadingSpinnerProps): JSX.Element {
  return (
    <div className={cn("flex items-center gap-2", className)} role="status" aria-live="polite">
      <Loader2 data-testid="loading-spinner-icon" className={cn("animate-spin", sizeClasses[size], color)} aria-hidden="true" />
      {text ? <span className="text-sm text-neutral-600">{text}</span> : null}
      <span className="sr-only">Loading</span>
    </div>
  );
}
