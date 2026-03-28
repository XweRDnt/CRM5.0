import { z } from "zod";
import { buildWorkspaceDemoCookieHeader } from "@/lib/auth/session";
import { isWorkspaceDemoToken } from "@/lib/utils/workspace-demo-token";

const paramsSchema = z.object({
  token: z.string().min(1),
});

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = paramsSchema.parse(await context.params);

  if (!isWorkspaceDemoToken(token)) {
    return new Response("Not found", { status: 404 });
  }

  const location = `/projects?workspaceDemoToken=${encodeURIComponent(token)}`;

  return new Response(null, {
    status: 307,
    headers: {
      Location: location,
      "Set-Cookie": buildWorkspaceDemoCookieHeader(token),
    },
  });
}
