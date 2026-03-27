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
  clearQueryValue("workspaceDemoToken");
  return token;
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
