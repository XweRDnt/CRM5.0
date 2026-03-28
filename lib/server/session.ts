import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_TOKEN_COOKIE, WORKSPACE_DEMO_TOKEN_COOKIE } from "@/lib/auth/session";
import type { ServerSession } from "@/lib/auth/types";
import { authService } from "@/lib/services/auth.service";
import { isPlatformAdminEmail } from "@/lib/services/platform-admin.service";

export async function getServerSession(): Promise<ServerSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value || cookieStore.get(WORKSPACE_DEMO_TOKEN_COOKIE)?.value || "";

  if (!token) {
    return null;
  }

  try {
    const [payload, user] = await Promise.all([authService.verifyToken(token), authService.getCurrentUser(token)]);

    return {
      token,
      payload,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isAdmin: isPlatformAdminEmail(user.email),
        isDemo: payload.isDemo === true,
        tenant: {
          id: user.tenant?.id ?? user.tenantId,
          name: user.tenant?.name ?? "",
          slug: user.tenant?.slug ?? "",
        },
      },
    };
  } catch {
    return null;
  }
}

export async function requireServerSession(nextPath: string): Promise<ServerSession> {
  const session = await getServerSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return session;
}
