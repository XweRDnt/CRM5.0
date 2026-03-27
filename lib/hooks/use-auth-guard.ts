"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { mutate } from "swr";
import { clearWorkspaceDemoToken, getAuthTokenState } from "@/lib/utils/client-api";

const AUTH_GUARD_TIMEOUT_MS = 8000;

export type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isAdmin: boolean;
  isDemo?: boolean;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
};

export function useAuthGuard(): { ready: boolean; user: AuthUser | null } {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const authTokenState = getAuthTokenState();
    const token = authTokenState.token;

    if (!token) {
      setReady(true);
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
        if (!cancelled) {
          setUser(currentUser);
          setReady(true);
        }
      } catch {
        await mutate(() => true, undefined, { revalidate: false });
        const hasPrimarySession = typeof window !== "undefined" && Boolean(localStorage.getItem("token"));

        if (authTokenState.source === "workspace-demo") {
          clearWorkspaceDemoToken();
          if (hasPrimarySession) {
            if (!cancelled) {
              setUser(null);
              setReady(true);
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
          setUser(null);
          setReady(true);
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

  return { ready, user };
}
