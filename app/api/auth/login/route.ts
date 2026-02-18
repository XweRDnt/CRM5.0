import { z } from "zod";
import { authService } from "@/lib/services/auth.service";
import { handleAPIError } from "@/lib/utils/api-error";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = loginSchema.parse(body);
    const data = await authService.login(validated.email, validated.password, validated.tenantSlug);
    return Response.json(data, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
}
