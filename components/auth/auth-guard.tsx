"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuthGuard, type AuthUser } from "@/lib/hooks/use-auth-guard";

type AuthGuardProps = {
  children: (args: { user: AuthUser }) => ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps): JSX.Element {
  const { ready, user } = useAuthGuard();

  if (!ready || !user) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-neutral-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </section>
    );
  }

  return <>{children({ user })}</>;
}
