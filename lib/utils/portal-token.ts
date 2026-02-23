import { randomBytes } from "node:crypto";

export function resolvePortalProjectToken(token: string): string | null {
  const normalized = token.trim();
  return normalized.length > 0 ? normalized : null;
}

export function generatePortalProjectToken(): string {
  return `pt_${randomBytes(18).toString("base64url")}`;
}
