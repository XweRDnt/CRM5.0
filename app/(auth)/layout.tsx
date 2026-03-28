import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }): JSX.Element {
  return <section className="min-h-[100dvh] overflow-hidden bg-[#060b16]">{children}</section>;
}
