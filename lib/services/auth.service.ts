import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/utils/db";
import { inviteService } from "@/lib/services/invite.service";
import type { SignupInput, SignupResult, LoginResult, JWTPayload, User, UserRole } from "@/types";

export class AuthService {
  private toSlug(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }

  private async generateUniqueTenantSlug(workspaceName: string): Promise<string> {
    const base = this.toSlug(workspaceName) || `workspace-${Date.now().toString(36)}`;
    let candidate = base;
    let sequence = 1;

    while (true) {
      const exists = await prisma.tenant.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });

      if (!exists) {
        return candidate;
      }

      sequence += 1;
      candidate = `${base}-${sequence}`;
    }
  }

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
    const { email, password, firstName, lastName, workspaceName, inviteToken, tenantName, tenantSlug } = data;

    if (!email || !password || !firstName || !lastName) {
      throw new Error("Email, password, firstName and lastName are required");
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
        if (inviteToken) {
          const invite = await inviteService.validateInviteToken(inviteToken);
          const inviteTenant = await tx.tenant.findUnique({
            where: { id: invite.workspace.tenantId },
            select: { id: true, name: true, slug: true },
          });

          if (!inviteTenant) {
            throw new Error("Workspace tenant not found");
          }

          const createdUser = await tx.user.create({
            data: {
              tenantId: inviteTenant.id,
              role: "EDITOR",
              firstName,
              lastName,
              email,
              passwordHash,
              isActive: true,
            },
          });

          await tx.workspaceMember.upsert({
            where: {
              workspaceId_userId: {
                workspaceId: invite.workspaceId,
                userId: createdUser.id,
              },
            },
            create: {
              workspaceId: invite.workspaceId,
              userId: createdUser.id,
              role: "EDITOR",
            },
            update: {},
          });

          return { user: createdUser, tenant: inviteTenant };
        }

        const workspaceLabel = workspaceName ?? tenantName;
        if (!workspaceLabel || workspaceLabel.trim().length === 0) {
          throw new Error("workspaceName is required");
        }

        const resolvedTenantSlug = tenantSlug && tenantSlug.trim().length > 0 ? tenantSlug.trim() : await this.generateUniqueTenantSlug(workspaceLabel);
        const createdTenant = await tx.tenant.create({
          data: {
            name: workspaceLabel.trim(),
            slug: resolvedTenantSlug,
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

        const workspace = await tx.workspace.create({
          data: {
            tenantId: createdTenant.id,
            name: workspaceLabel.trim(),
            ownerId: createdUser.id,
          },
        });

        await tx.workspaceMember.create({
          data: {
            workspaceId: workspace.id,
            userId: createdUser.id,
            role: "OWNER",
          },
        });

        return { user: createdUser, tenant: createdTenant };
      });

      user = created.user;
      tenant = created.tenant;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : String(error.meta?.target ?? "");
        if (target.includes("slug") || target.includes("email")) {
          throw new Error(target.includes("slug") ? "Tenant slug already exists" : "Email already exists");
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

  async login(email: string, password: string, tenantSlug?: string): Promise<LoginResult> {
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const tenant = tenantSlug
      ? await prisma.tenant.findUnique({
          where: { slug: tenantSlug },
          select: { id: true, name: true, slug: true },
        })
      : null;

    if (tenantSlug && !tenant) {
      throw new Error("Tenant not found");
    }

    let user: { id: string; tenantId: string; role: UserRole; firstName: string; lastName: string; email: string; isActive: boolean; passwordHash: string | null };
    let resolvedTenant: { id: string; name: string; slug: string };

    if (tenant) {
      const users = await prisma.user.findMany({
        where: {
          tenantId: tenant.id,
          email,
        },
        take: 2,
      });

      if (users.length === 0) {
        throw new Error("Invalid credentials");
      }

      user = users[0] as typeof user;
      resolvedTenant = tenant;
    } else {
      const users = await prisma.user.findMany({
        where: { email },
        include: {
          tenant: {
            select: { id: true, name: true, slug: true },
          },
        },
        take: 2,
      });

      if (users.length === 0) {
        throw new Error("Invalid credentials");
      }

      if (users.length > 1) {
        throw new Error("Multiple workspaces found for this email, provide tenantSlug");
      }

      user = {
        id: users[0].id,
        tenantId: users[0].tenantId,
        role: users[0].role as UserRole,
        firstName: users[0].firstName,
        lastName: users[0].lastName,
        email: users[0].email,
        isActive: users[0].isActive,
        passwordHash: users[0].passwordHash,
      };
      resolvedTenant = users[0].tenant;
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
        id: resolvedTenant.id,
        name: resolvedTenant.name,
        slug: resolvedTenant.slug,
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
