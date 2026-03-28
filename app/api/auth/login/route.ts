import { z } from "zod";
import { buildSessionCookieHeaders } from "@/lib/auth/session";
import { authService } from "@/lib/services/auth.service";
import { handleAPIError } from "@/lib/utils/api-error";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = loginSchema.parse(body);
    const data = await authService.login(validated.email, validated.password, validated.tenantSlug);
    const response = Response.json(data, { status: 200 });
    for (const cookie of buildSessionCookieHeaders({ token: data.token, tenantId: data.tenant.id })) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch (error) {
    return handleAPIError(error);
  }
}
