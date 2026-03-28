import type { JWTPayload } from "@/types";

export type AuthenticatedAppUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isAdmin: boolean;
  isDemo?: boolean;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
};

export type ServerSession = {
  token: string;
  payload: JWTPayload;
  user: AuthenticatedAppUser;
};
