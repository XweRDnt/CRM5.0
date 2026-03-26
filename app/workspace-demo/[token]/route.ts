import { z } from "zod";
import { isWorkspaceDemoToken } from "@/lib/utils/workspace-demo-token";

const paramsSchema = z.object({
  token: z.string().min(1),
});

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = paramsSchema.parse(await context.params);

  if (!isWorkspaceDemoToken(token)) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(null, {
    status: 307,
    headers: {
      Location: new URL(`/projects?workspaceDemoToken=${encodeURIComponent(token)}`, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").toString(),
      "Set-Cookie": `workspaceDemoToken=${encodeURIComponent(token)}; Path=/; SameSite=Lax`,
    },
  });
}
