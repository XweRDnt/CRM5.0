import { authService } from "@/lib/services/auth.service";
import type { JWTPayload } from "@/types";

export type AuthenticatedRequest = Request & { user: JWTPayload };

export function withAuth(
  handler: (req: AuthenticatedRequest) => Promise<Response> | Response,
): (req: Request) => Promise<Response>;
export function withAuth<TContext>(
  handler: (req: AuthenticatedRequest, context: TContext) => Promise<Response> | Response,
): (req: Request, context: TContext) => Promise<Response>;
export function withAuth<TContext>(
  handler: (req: AuthenticatedRequest, context?: TContext) => Promise<Response> | Response,
) {
  return async (req: Request, context?: TContext): Promise<Response> => {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const payload = await authService.verifyToken(token);
      (req as AuthenticatedRequest).user = payload;
      if (context === undefined) {
        return (handler as (req: AuthenticatedRequest) => Promise<Response> | Response)(
          req as AuthenticatedRequest,
        );
      }

      return (
        handler as (req: AuthenticatedRequest, context: TContext) => Promise<Response> | Response
      )(req as AuthenticatedRequest, context);
    } catch {
      return Response.json({ error: "Invalid token" }, { status: 401 });
    }
  };
}
