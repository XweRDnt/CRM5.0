import { withAuth } from "@/lib/middleware/auth";
import { authService } from "@/lib/services/auth.service";
import { isPlatformAdminEmail } from "@/lib/services/platform-admin.service";
import { handleAPIError } from "@/lib/utils/api-error";

export const GET = withAuth(async (request) => {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const user = await authService.getCurrentUser(token);
    const isAdmin = isPlatformAdminEmail(user.email);
    const { passwordHash: _passwordHash, ...safeUser } = user;

    return Response.json(
      {
        ...safeUser,
        isAdmin,
        isDemo: request.user.isDemo === true,
      },
      { status: 200 },
    );
  } catch (error) {
    return handleAPIError(error);
  }
});
