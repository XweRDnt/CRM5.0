"use client";

import { createContext, useContext } from "react";
import type { AuthenticatedAppUser } from "@/lib/auth/types";

const DashboardUserContext = createContext<AuthenticatedAppUser | null>(null);

export function DashboardUserProvider({
  user,
  children,
}: {
  user: AuthenticatedAppUser;
  children: React.ReactNode;
}): JSX.Element {
  return <DashboardUserContext.Provider value={user}>{children}</DashboardUserContext.Provider>;
}

export function useDashboardUser(): AuthenticatedAppUser {
  const user = useContext(DashboardUserContext);

  if (!user) {
    throw new Error("useDashboardUser must be used within DashboardUserProvider");
  }

  return user;
}
