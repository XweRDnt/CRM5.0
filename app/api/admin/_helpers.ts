import type { AuthenticatedRequest } from "@/lib/middleware/auth";
import { assertPlatformAdmin } from "@/lib/services/platform-admin.service";

export async function assertAdminRequest(request: AuthenticatedRequest): Promise<{ id: string; email: string }> {
  return assertPlatformAdmin(request.user.userId);
}

export function parseBooleanQuery(value: string | null): boolean | undefined {
  if (value === null) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }

  return undefined;
}

