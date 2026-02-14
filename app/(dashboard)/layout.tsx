import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }): JSX.Element {
  return <section className="min-h-screen bg-white">{children}</section>;
}