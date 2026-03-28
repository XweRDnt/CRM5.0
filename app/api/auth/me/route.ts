import { withAuth } from "@/lib/middleware/auth";
import { getRequestAuthToken } from "@/lib/auth/session";
import { authService } from "@/lib/services/auth.service";
import { isPlatformAdminEmail } from "@/lib/services/platform-admin.service";
import { handleAPIError } from "@/lib/utils/api-error";
import { withServerTiming } from "@/lib/utils/server-timing";

export const GET = withAuth(async (request) => {
  return withServerTiming("auth-me", async () => {
    try {
      const token = getRequestAuthToken(request);
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
});
