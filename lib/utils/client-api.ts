export function getAuthToken(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem("token") ?? "";
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
    try {
      const errorJson = (await res.json()) as { error?: { message?: string } | string };
      if (typeof errorJson.error === "string") {
        message = errorJson.error;
      } else if (errorJson.error?.message) {
        message = errorJson.error.message;
      }
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}
