export class ApiRequestError<TPayload = unknown> extends Error {
  constructor(
    message: string,
    public status: number,
    public payload?: TPayload,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

const WORKSPACE_DEMO_STORAGE_KEY = "workspaceDemoToken";
const AUTH_USER_STORAGE_KEY = "authUser";

export type CachedAuthUser = {
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

function getQueryValue(name: string): string {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get(name) ?? "";
}

function getSessionStorageValue(key: string): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.sessionStorage.getItem(key) ?? "";
}

function setSessionStorageValue(key: string, value: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(key, value);
}

function setDocumentCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; path=/; samesite=lax`;
}

function clearQueryValue(name: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (!url.searchParams.has(name)) {
    return;
  }

  url.searchParams.delete(name);
  const search = url.searchParams.toString();
  const nextUrl = `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}

export function clearWorkspaceDemoToken(): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(WORKSPACE_DEMO_STORAGE_KEY);
  }

  if (typeof document === "undefined") {
    return;
  }

  document.cookie = "workspaceDemoToken=; Max-Age=0; path=/; SameSite=Lax";
}

export function persistWorkspaceDemoTokenFromQuery(): string {
  const token = getQueryValue("workspaceDemoToken");
  if (!token) {
    return "";
  }

  setSessionStorageValue(WORKSPACE_DEMO_STORAGE_KEY, token);
  setDocumentCookie("workspaceDemoToken", token, 60 * 60 * 24 * 365);
  clearQueryValue("workspaceDemoToken");
  return token;
}

export function readCachedAuthUser(): CachedAuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as CachedAuthUser;
  } catch {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    return null;
  }
}

export function writeCachedAuthUser(user: CachedAuthUser): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearCachedAuthUser(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
}

type PersistAuthSessionInput = {
  token: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
};

export function persistAuthSession(input: PersistAuthSessionInput): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem("token", input.token);
  localStorage.setItem("tenantId", input.tenant.id);
  writeCachedAuthUser({
    id: input.user.id,
    firstName: input.user.firstName,
    lastName: input.user.lastName,
    email: input.user.email,
    role: input.user.role,
    isAdmin: false,
    tenant: input.tenant,
  });
}

export type AuthTokenState =
  | { source: "workspace-demo"; token: string }
  | { source: "auth"; token: string }
  | { source: "none"; token: "" };

export function getAuthTokenState(): AuthTokenState {
  if (typeof window === "undefined") {
    return { source: "none", token: "" };
  }

  const workspaceDemoToken = persistWorkspaceDemoTokenFromQuery() || getSessionStorageValue(WORKSPACE_DEMO_STORAGE_KEY);
  if (workspaceDemoToken) {
    return { source: "workspace-demo", token: workspaceDemoToken };
  }

  const authToken = localStorage.getItem("token") || "";
  if (authToken) {
    return { source: "auth", token: authToken };
  }

  return { source: "none", token: "" };
}

export function getAuthToken(): string {
  return getAuthTokenState().token;
}

export function getTenantId(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem("tenantId") ?? "";
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(init?.headers);

  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let message = "Request failed";
    let payload: unknown;
    try {
      const errorJson = (await res.json()) as { error?: { message?: string } | string };
      payload = errorJson;
      if (typeof errorJson.error === "string") {
        message = errorJson.error;
      } else if (errorJson.error?.message) {
        message = errorJson.error.message;
      }
    } catch {
      // ignore parse error
    }
    throw new ApiRequestError(message, res.status, payload);
  }

  return (await res.json()) as T;
}
