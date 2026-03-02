import { prisma } from "@/lib/utils/db";
import { APIError } from "@/lib/utils/api-error";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function parseEnvEmailList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
}

export function getPlatformAdminEmails(): string[] {
  const primary = parseEnvEmailList(process.env.PLATFORM_ADMIN_EMAILS);
  if (primary.length > 0) {
    return Array.from(new Set(primary));
  }

  const fallback = normalizeEmail(process.env.ADMIN_EMAIL ?? "");
  return fallback ? [fallback] : [];
}

export function isPlatformAdminEmail(email: string): boolean {
  const candidates = getPlatformAdminEmails();
  if (candidates.length === 0) {
    return false;
  }

  return candidates.includes(normalizeEmail(email));
}

export async function getPlatformAdminUser(userId: string): Promise<{ id: string; email: string } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) {
    return null;
  }

  if (!isPlatformAdminEmail(user.email)) {
    return null;
  }

  return user;
}

export async function assertPlatformAdmin(userId: string): Promise<{ id: string; email: string }> {
  const user = await getPlatformAdminUser(userId);
  if (!user) {
    throw new APIError(403, "Forbidden", "FORBIDDEN");
  }
  return user;
}

