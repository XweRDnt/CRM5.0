import type { ReactNode } from "react";

export function Dialog({ children }: { children: ReactNode }): JSX.Element {
  return <div className="rounded-lg border border-neutral-200 bg-white p-4">{children}</div>;
}
