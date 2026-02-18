import { cn } from "@/lib/utils/cn";

export interface SkeletonProps {
  type?: "text" | "card" | "avatar" | "custom";
  count?: number;
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({
  type = "text",
  count = 1,
  className,
  width,
  height,
}: SkeletonProps): JSX.Element {
  const safeCount = Math.max(1, count);

  const renderSkeleton = (index: number): JSX.Element => {
    if (type === "card") {
      return (
        <div
          key={index}
          className={cn("animate-pulse space-y-3 rounded-lg border border-neutral-200 p-4", className)}
          data-testid="skeleton-card"
        >
          <div className="h-4 w-1/4 rounded bg-neutral-200" />
          <div className="h-20 rounded bg-neutral-200" />
        </div>
      );
    }

    if (type === "avatar") {
      return (
        <div key={index} className={cn("animate-pulse", className)} data-testid="skeleton-avatar">
          <div className="h-12 w-12 rounded-full bg-neutral-200" />
        </div>
      );
    }

    if (type === "custom") {
      return (
        <div
          key={index}
          className={cn("animate-pulse rounded bg-neutral-200", className)}
          style={{ width, height }}
          data-testid="skeleton-custom"
        />
      );
    }

    return (
      <div key={index} className={cn("animate-pulse space-y-2", className)} data-testid="skeleton-text">
        <div className="h-4 w-3/4 rounded bg-neutral-200" />
        <div className="h-4 w-1/2 rounded bg-neutral-200" />
      </div>
    );
  };

  return <div className="space-y-3">{Array.from({ length: safeCount }, (_, index) => renderSkeleton(index))}</div>;
}
