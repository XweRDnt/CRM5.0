import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/utils/db";
import type { SignupInput, SignupResult, LoginResult, JWTPayload, User, UserRole } from "@/types";

export class AuthService {
  private getJWTSecret(): string {
    const secret = process.env.JWT_SECRET;

    if (!secret && process.env.NODE_ENV === "production") {
      throw new Error("CRITICAL: JWT_SECRET must be set in production environment");
    }

    return secret || "dev-secret-change-me-insecure";
  }

  async hashPassword(password: string): Promise<string> {
    if (typeof password !== "string" || password.trim().length === 0) {
      throw new Error("Password is required");
    }

    return bcrypt.hash(password, 10);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (typeof password !== "string" || typeof hash !== "string" || hash.trim().length === 0) {
      return false;
    }

    try {
      return await bcrypt.compare(password, hash);
    } catch {
      return false;
    }
  }

  async generateToken(userId: string, tenantId: string, role: UserRole): Promise<string> {
    if (typeof userId !== "string" || userId.trim().length === 0) {
      throw new Error("userId is required");
    }

    if (typeof tenantId !== "string" || tenantId.trim().length === 0) {
      throw new Error("tenantId is required");
    }

    const secret = this.getJWTSecret();
    const payload: JWTPayload = {
      userId,
      tenantId,
      role,
    };

    return jwt.sign(payload, secret, { expiresIn: "30d" });
  }

  async verifyToken(token: string): Promise<JWTPayload> {
    if (typeof token !== "string" || token.trim().length === 0) {
      throw new Error("Token is required");
    }

    const secret = this.getJWTSecret();

    try {
      return jwt.verify(token, secret) as JWTPayload;
    } catch {
      throw new Error("Invalid or expired token");
    }
  }

  async signup(data: SignupInput): Promise<SignupResult> {
    const { email, password, firstName, lastName, tenantName, tenantSlug } = data;

    if (!email || !password || !firstName || !lastName || !tenantName || !tenantSlug) {
      throw new Error("All fields are required");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    const existingUser = await prisma.user.findFirst({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      throw new Error("Email already exists");
    }

    const passwordHash = await this.hashPassword(password);

    let user: {
      id: string;
      tenantId: string;
      role: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    let tenant: {
      id: string;
      name: string;
      slug: string;
    };

    try {
      const created = await prisma.$transaction(async (tx) => {
        const createdTenant = await tx.tenant.create({
          data: {
            name: tenantName,
            slug: tenantSlug,
          },
        });

        const createdUser = await tx.user.create({
          data: {
            tenantId: createdTenant.id,
            role: "OWNER",
            firstName,
            lastName,
            email,
            passwordHash,
            isActive: true,
          },
        });

        return { user: createdUser, tenant: createdTenant };
      });

      user = created.user;
      tenant = created.tenant;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : String(error.meta?.target ?? "");
        if (target.includes("slug")) {
          throw new Error("Tenant slug already exists");
        }
      }
      throw error;
    }

    const token = await this.generateToken(user.id, tenant.id, user.role as UserRole);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role as UserRole,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      token,
    };
  }

  async login(email: string, password: string, tenantSlug: string): Promise<LoginResult> {
    if (!email || !password || !tenantSlug) {
      throw new Error("Email, password and tenantSlug are required");
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, name: true, slug: true },
    });
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const user = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email,
        },
      },
    });

    if (!user) {
      throw new Error("Invalid credentials");
    }

    if (!user.isActive) {
      throw new Error("Account is deactivated");
    }

    if (!user.passwordHash) {
      throw new Error("Invalid credentials");
    }

    const isValidPassword = await this.verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error("Invalid credentials");
    }

    const token = await this.generateToken(user.id, user.tenantId, user.role as UserRole);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role as UserRole,
        tenantId: user.tenantId,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      token,
    };
  }

  async getCurrentUser(token: string): Promise<User> {
    const payload = await this.verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { tenant: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.isActive) {
      throw new Error("Account is deactivated");
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role as UserRole,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      passwordHash: user.passwordHash,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
      },
    };
  }
}

export const authService = new AuthService();
