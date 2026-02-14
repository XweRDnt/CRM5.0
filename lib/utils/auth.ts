import jwt from "jsonwebtoken";
import type { ServiceContext } from "@/types";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";

export function signAccessToken(context: ServiceContext): string {
  return jwt.sign(context, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAccessToken(token: string): ServiceContext {
  return jwt.verify(token, JWT_SECRET) as ServiceContext;
}
