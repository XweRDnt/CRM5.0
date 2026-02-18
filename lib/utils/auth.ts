import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import type { ServiceContext } from "@/types";

const JWT_SECRET = (process.env.JWT_SECRET ?? "dev-secret-change-me") as Secret;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";

export function signAccessToken(context: ServiceContext): string {
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as SignOptions["expiresIn"],
  };

  return jwt.sign(context, JWT_SECRET, options);
}

export function verifyAccessToken(token: string): ServiceContext {
  return jwt.verify(token, JWT_SECRET) as ServiceContext;
}