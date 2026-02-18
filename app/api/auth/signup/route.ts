import { z } from "zod";
import { authService } from "@/lib/services/auth.service";
import { handleAPIError } from "@/lib/utils/api-error";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  tenantName: z.string().min(1).max(120),
  tenantSlug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = signupSchema.parse(body);
    const data = await authService.signup(validated);
    return Response.json(data, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}
