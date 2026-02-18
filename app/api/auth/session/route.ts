import { withAuth } from "@/lib/middleware/auth";
import { authService } from "@/lib/services/auth.service";
import { handleAPIError } from "@/lib/utils/api-error";

export const GET = withAuth(async (request) => {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const data = await authService.getCurrentUser(token);
    return Response.json(data, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
