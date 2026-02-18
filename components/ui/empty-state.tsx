import type { ReactNode } from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils/cn";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps): JSX.Element {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
      {icon ? <div className="text-neutral-400">{icon}</div> : null}
      <h3 className="mt-4 text-lg font-semibold text-neutral-900">{title}</h3>
      {description ? <p className="mt-2 text-sm text-neutral-600">{description}</p> : null}
      {action ? (
        <Button type="button" onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
