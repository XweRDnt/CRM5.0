export async function withServerTiming(
  label: string,
  factory: () => Promise<Response> | Response,
): Promise<Response> {
  const startedAt = performance.now();
  const response = await factory();
  const duration = Math.max(0, performance.now() - startedAt).toFixed(1);
  response.headers.set("Server-Timing", `${label};dur=${duration}`);
  return response;
}
