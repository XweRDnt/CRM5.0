const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export const AUTH_TOKEN_COOKIE = "authToken";
export const TENANT_ID_COOKIE = "tenantId";
export const WORKSPACE_DEMO_TOKEN_COOKIE = "workspaceDemoToken";

type SessionCookieInput = {
  token: string;
  tenantId: string;
};

function buildCookie(name: string, value: string, maxAge: number): string {
  const encodedValue = encodeURIComponent(value);
  return `${name}=${encodedValue}; Max-Age=${maxAge}; Path=/; SameSite=Lax; HttpOnly`;
}

function buildReadableCookie(name: string, value: string, maxAge: number): string {
  const encodedValue = encodeURIComponent(value);
  return `${name}=${encodedValue}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

export function buildSessionCookieHeaders(input: SessionCookieInput): string[] {
  return [
    buildCookie(AUTH_TOKEN_COOKIE, input.token, ONE_YEAR_IN_SECONDS),
    buildReadableCookie(TENANT_ID_COOKIE, input.tenantId, ONE_YEAR_IN_SECONDS),
  ];
}

export function buildWorkspaceDemoCookieHeader(token: string): string {
  return buildCookie(WORKSPACE_DEMO_TOKEN_COOKIE, token, ONE_YEAR_IN_SECONDS);
}

export function buildClearedSessionCookieHeaders(): string[] {
  return [
    buildCookie(AUTH_TOKEN_COOKIE, "", 0),
    buildReadableCookie(TENANT_ID_COOKIE, "", 0),
    buildCookie(WORKSPACE_DEMO_TOKEN_COOKIE, "", 0),
  ];
}

export function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, chunk) => {
    const [rawName, ...rawValue] = chunk.split("=");
    const name = rawName?.trim();
    if (!name) {
      return acc;
    }

    acc[name] = decodeURIComponent(rawValue.join("=").trim());
    return acc;
  }, {});
}

export function getRequestAuthToken(request: Request): string {
  const headerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (headerToken) {
    return headerToken;
  }

  const cookies = parseCookieHeader(request.headers.get("cookie"));
  return cookies[AUTH_TOKEN_COOKIE] || cookies[WORKSPACE_DEMO_TOKEN_COOKIE] || "";
}
