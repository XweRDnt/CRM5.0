import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }): JSX.Element {
  return <section className="min-h-screen bg-neutral-50">{children}</section>;
}