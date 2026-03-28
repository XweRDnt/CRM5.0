"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { mutate } from "swr";
import type { AuthenticatedAppUser } from "@/lib/auth/types";
import {
  clearCachedAuthUser,
  clearWorkspaceDemoToken,
  getAuthTokenState,
  readCachedAuthUser,
  writeCachedAuthUser,
} from "@/lib/utils/client-api";

const AUTH_GUARD_TIMEOUT_MS = 8000;

export type AuthUser = AuthenticatedAppUser;

export function useAuthGuard(): { ready: boolean; user: AuthUser | null } {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<{ ready: boolean; user: AuthUser | null }>(() => {
    const authTokenState = getAuthTokenState();
    const cachedUser = authTokenState.token ? readCachedAuthUser() : null;

    return {
      ready: cachedUser !== null,
      user: cachedUser,
    };
  });

  useEffect(() => {
    const authTokenState = getAuthTokenState();
    const token = authTokenState.token;

    if (!token) {
      setState({ ready: true, user: null });
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), AUTH_GUARD_TIMEOUT_MS);

    const validate = async (): Promise<void> => {
      try {
        const response = await fetch("/api/auth/me", {
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Unauthorized");
        }

        const currentUser = (await response.json()) as AuthUser;
        writeCachedAuthUser(currentUser);
        if (!cancelled) {
          setState({ user: currentUser, ready: true });
        }
      } catch {
        await mutate(() => true, undefined, { revalidate: false });
        const hasPrimarySession = typeof window !== "undefined" && Boolean(localStorage.getItem("token"));
        clearCachedAuthUser();

        if (authTokenState.source === "workspace-demo") {
          clearWorkspaceDemoToken();
          if (hasPrimarySession) {
            if (!cancelled) {
              setState({ user: null, ready: true });
            }
            router.replace(pathname);
            return;
          }
        } else {
          localStorage.removeItem("token");
          localStorage.removeItem("tenantId");
          clearWorkspaceDemoToken();
        }

        if (!cancelled) {
          setState({ user: null, ready: true });
        }
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      } finally {
        window.clearTimeout(timeout);
      }
    };

    void validate();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return state;
}
