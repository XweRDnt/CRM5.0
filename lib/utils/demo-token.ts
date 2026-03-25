export function isDemoToken(token: string): boolean {
  const configuredToken = process.env.DEMO_PORTAL_TOKEN;

  if (!configuredToken) {
    return false;
  }

  return token === configuredToken;
}
