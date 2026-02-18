function decodeBase64Json(value: string): Record<string, unknown> | null {
  try {
    const jsonText = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(jsonText) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function resolvePortalVersionId(token: string): string | null {
  const direct = decodeBase64Json(token);
  if (direct && typeof direct.versionId === "string" && direct.versionId.trim()) {
    const exp = typeof direct.exp === "number" ? direct.exp : undefined;
    if (exp && Date.now() / 1000 > exp) {
      return null;
    }
    return direct.versionId;
  }

  const jwtParts = token.split(".");
  if (jwtParts.length === 3) {
    const payload = decodeBase64Json(jwtParts[1]);
    if (payload && typeof payload.versionId === "string" && payload.versionId.trim()) {
      const exp = typeof payload.exp === "number" ? payload.exp : undefined;
      if (exp && Date.now() / 1000 > exp) {
        return null;
      }
      return payload.versionId;
    }
  }

  return token.trim() || null;
}

