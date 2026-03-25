export function isWorkspaceDemoToken(token: string): boolean {
  const configuredToken = process.env.DEMO_WORKSPACE_TOKEN;
  return Boolean(configuredToken) && token === configuredToken;
}
