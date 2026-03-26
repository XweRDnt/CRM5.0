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

function getCookieValue(name: string): string {
  if (typeof document === "undefined") {
    return "";
  }

  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!cookie) {
    return "";
  }

  return decodeURIComponent(cookie.slice(prefix.length));
}

function getQueryValue(name: string): string {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get(name) ?? "";
}

export function clearWorkspaceDemoToken(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = "workspaceDemoToken=; Max-Age=0; path=/; SameSite=Lax";
}

export function getAuthToken(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return getCookieValue("workspaceDemoToken") || getQueryValue("workspaceDemoToken") || localStorage.getItem("token") || "";
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
