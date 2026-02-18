"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthToken } from "@/lib/utils/client-api";

type CurrentUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
};

type HealthResponse = {
  status?: string;
};

const userFetcher = async (): Promise<CurrentUser> => {
  const token = getAuthToken();
  const response = await fetch("/api/auth/me", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error("Failed to load user settings");
  }
  return (await response.json()) as CurrentUser;
};

const healthFetcher = async (): Promise<HealthResponse> => {
  const response = await fetch("/api/health");
  if (!response.ok) {
    throw new Error("Health endpoint unavailable");
  }
  return (await response.json()) as HealthResponse;
};

export default function SettingsPage(): JSX.Element {
  const router = useRouter();
  const { data: user, error: userError, isLoading: userLoading } = useSWR("settings-user", userFetcher);
  const { data: health, error: healthError } = useSWR("settings-health", healthFetcher, { refreshInterval: 30_000 });

  const logout = (): void => {
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
          {userLoading && <p className="text-neutral-500">Loading account...</p>}
          {userError && <p className="text-red-600">{userError instanceof Error ? userError.message : "Failed to load account"}</p>}
          {user && (
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
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-0 border-b border-neutral-200 px-4 pb-2 pt-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Tenant</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pt-3 text-sm">
          {user && (
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
          )}
          {!user && !userLoading && !userError && <p className="text-neutral-500">No tenant data.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-0 border-b border-neutral-200 px-4 pb-2 pt-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">System Health</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pt-3 text-sm">
          {healthError && <p className="text-red-600">Service status is unavailable.</p>}
          {!healthError && (
            <div className="divide-y divide-neutral-200">
              <p className="py-2">Status: {health?.status ?? "unknown"}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="destructive" onClick={logout}>
        Logout
      </Button>
    </section>
  );
}
