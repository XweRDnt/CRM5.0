"use client";

import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuthenticatedAppUser } from "@/lib/auth/types";
import { clearCachedAuthUser, clearWorkspaceDemoToken } from "@/lib/utils/client-api";

type HealthResponse = {
  status?: string;
  dependencies?: {
    database?: string;
    redis?: string;
  };
};

const healthFetcher = async (): Promise<HealthResponse> => {
  const response = await fetch("/api/health");
  const payload = (await response.json()) as { data?: HealthResponse };
  if (payload.data) {
    return payload.data;
  }
  if (!response.ok) {
    throw new Error("Health endpoint unavailable");
  }
  return {};
};

export function SettingsPageClient({
  user,
  initialHealth,
}: {
  user: AuthenticatedAppUser;
  initialHealth: HealthResponse;
}): JSX.Element {
  const router = useRouter();
  const { data: health, error: healthError } = useSWR("settings-health", healthFetcher, {
    fallbackData: initialHealth,
    refreshInterval: 30_000,
    revalidateOnMount: false,
  });

  const logout = (): void => {
    clearCachedAuthUser();
    clearWorkspaceDemoToken();
    localStorage.removeItem("token");
    localStorage.removeItem("tenantId");
    router.replace("/login");
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-neutral-500">Account, tenant and runtime diagnostics.</p>
      </header>

      <Card>
        <CardHeader className="space-y-0 border-b border-neutral-200 px-4 pb-2 pt-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Account</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pt-3 text-sm">
          <div className="divide-y divide-neutral-200">
            <p className="py-2">
              <span className="font-medium">Name:</span> {user.firstName} {user.lastName}
            </p>
            <p className="py-2">
              <span className="font-medium">Email:</span> {user.email}
            </p>
            <p className="py-2">
              <span className="font-medium">Role:</span> {user.role}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-0 border-b border-neutral-200 px-4 pb-2 pt-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Tenant</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pt-3 text-sm">
          <div className="divide-y divide-neutral-200">
            <p className="py-2">
              <span className="font-medium">Name:</span> {user.tenant.name}
            </p>
            <p className="py-2">
              <span className="font-medium">Slug:</span> {user.tenant.slug}
            </p>
            <p className="py-2">
              <span className="font-medium">ID:</span> {user.tenant.id}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-0 border-b border-neutral-200 px-4 pb-2 pt-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">System Health</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pt-3 text-sm">
          {healthError ? <p className="text-red-600">Service status is unavailable.</p> : null}
          {!healthError ? (
            <div className="divide-y divide-neutral-200">
              <p className="py-2">Status: {health?.status ?? "unknown"}</p>
              <p className="py-2">Database: {health?.dependencies?.database ?? "unknown"}</p>
              <p className="py-2">Redis: {health?.dependencies?.redis ?? "unknown"}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Button variant="destructive" onClick={logout}>
        Logout
      </Button>
    </section>
  );
}
