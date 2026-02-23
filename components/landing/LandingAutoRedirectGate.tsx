"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LandingAutoRedirectGateProps = {
  children: ReactNode;
};

export function LandingAutoRedirectGate({ children }: LandingAutoRedirectGateProps): JSX.Element {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async (): Promise<void> => {
      const token = localStorage.getItem("token");
      if (!token) {
        if (!cancelled) {
          setReady(true);
        }
        return;
      }

      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          router.replace("/projects");
          return;
        }
      } catch {
        // ignore and show landing
      }

      if (!cancelled) {
        setReady(true);
      }
    };

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return <main className="min-h-screen bg-neutral-50" />;
  }

  return <>{children}</>;
}
