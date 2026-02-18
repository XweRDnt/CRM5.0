import jwt from "jsonwebtoken";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { AuthService } from "@/lib/services/auth.service";
import { prisma } from "@/lib/utils/db";
import { UserRole, type SignupInput } from "@/types";

describe("AuthService", () => {
  let authService: AuthService;

  const createMockSignupData = (overrides: Partial<SignupInput> = {}): SignupInput => {
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    return {
      email: `user-${nonce}@example.com`,
      password: "SecurePass123!",
      firstName: "Test",
      lastName: "User",
      tenantName: `Tenant ${nonce}`,
      tenantSlug: `tenant-${nonce}`,
      ...overrides,
    };
  };

  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret-key-min-32-characters-long";

    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();

    authService = new AuthService();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("hashPassword", () => {
    test("returns bcrypt hash string", async () => {
      const hash = await authService.hashPassword("TestPassword123");

      expect(typeof hash).toBe("string");
      expect(hash).not.toBe("TestPassword123");
      expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true);
    });

    test("generates different hashes for same password", async () => {
      const password = "SamePassword123!";

      const hash1 = await authService.hashPassword(password);
      const hash2 = await authService.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    test("throws for empty password", async () => {
      await expect(authService.hashPassword("")).rejects.toThrow(/password|empty|required/i);
    });

    test("throws for non-string password", async () => {
      await expect(authService.hashPassword(42 as unknown as string)).rejects.toThrow(/password|string/i);
    });
  });

  describe("verifyPassword", () => {
    test("returns true for correct password", async () => {
      const password = "Correct#Pass123";
      const hash = await authService.hashPassword(password);

      await expect(authService.verifyPassword(password, hash)).resolves.toBe(true);
    });

    test("returns false for incorrect password", async () => {
      const hash = await authService.hashPassword("Correct#Pass123");

      await expect(authService.verifyPassword("Wrong#Pass123", hash)).resolves.toBe(false);
    });

    test("works with special characters in password", async () => {
      const password = "S!p@ce$-P^ssw0rd_#2026";
      const hash = await authService.hashPassword(password);

      await expect(authService.verifyPassword(password, hash)).resolves.toBe(true);
    });

    test("returns false for malformed hash", async () => {
      await expect(authService.verifyPassword("Password123", "not-a-valid-bcrypt-hash")).resolves.toBe(false);
    });

    test("returns false when hash is empty string", async () => {
      await expect(authService.verifyPassword("Password123", "")).resolves.toBe(false);
    });
  });

  describe("generateToken", () => {
    test("returns JWT token string", async () => {
      const token = await authService.generateToken("user-id", "tenant-id", UserRole.OWNER);

      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);
    });

    test("token contains correct payload values", async () => {
      const token = await authService.generateToken("user-1", "tenant-1", UserRole.PM);
      const payload = await authService.verifyToken(token);

      expect(payload.userId).toBe("user-1");
      expect(payload.tenantId).toBe("tenant-1");
      expect(payload.role).toBe(UserRole.PM);
    });

    test("token has expiration close to 7 days", async () => {
      const token = await authService.generateToken("user-exp", "tenant-exp", UserRole.EDITOR);
      const payload = await authService.verifyToken(token);

      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
      expect((payload.exp as number) - (payload.iat as number)).toBe(60 * 60 * 24 * 7);
    });

    test("generates different tokens for different issuance times", async () => {
      const token1 = await authService.generateToken("user-same", "tenant-same", UserRole.CLIENT_VIEWER);
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const token2 = await authService.generateToken("user-same", "tenant-same", UserRole.CLIENT_VIEWER);

      expect(token1).not.toBe(token2);
    });

    test("throws for empty userId", async () => {
      await expect(authService.generateToken("", "tenant-id", UserRole.OWNER)).rejects.toThrow(/userId|required|empty/i);
    });

    test("throws for empty tenantId", async () => {
      await expect(authService.generateToken("user-id", "", UserRole.OWNER)).rejects.toThrow(/tenantId|required|empty/i);
    });
  });

  describe("verifyToken", () => {
    test("returns payload for valid token", async () => {
      const token = await authService.generateToken("verify-user", "verify-tenant", UserRole.PM);

      const payload = await authService.verifyToken(token);

      expect(payload.userId).toBe("verify-user");
      expect(payload.tenantId).toBe("verify-tenant");
      expect(payload.role).toBe(UserRole.PM);
    });

    test("returns payload fields userId tenantId role", async () => {
      const token = await authService.generateToken("user-fields", "tenant-fields", UserRole.EDITOR);

      const payload = await authService.verifyToken(token);

      expect(payload).toMatchObject({
        userId: "user-fields",
        tenantId: "tenant-fields",
        role: UserRole.EDITOR,
      });
    });

    test("correctly verifies tokens from generateToken", async () => {
      const token = await authService.generateToken("user-pair", "tenant-pair", UserRole.OWNER);

      await expect(authService.verifyToken(token)).resolves.toEqual(
        expect.objectContaining({
          userId: "user-pair",
          tenantId: "tenant-pair",
          role: UserRole.OWNER,
        }),
      );
    });

    test("throws for malformed token", async () => {
      await expect(authService.verifyToken("this-is-not-a-jwt")).rejects.toThrow(/token|jwt|invalid/i);
    });

    test("throws for token signed with wrong secret", async () => {
      const wrongSignedToken = jwt.sign(
        { userId: "u", tenantId: "t", role: UserRole.PM },
        "another-secret-key-that-does-not-match",
      );

      await expect(authService.verifyToken(wrongSignedToken)).rejects.toThrow(/signature|invalid|token/i);
    });

    test("throws when token is empty", async () => {
      await expect(authService.verifyToken("")).rejects.toThrow(/token|empty|required/i);
    });
  });

  describe("JWT secret validation", () => {
    test("throws in production without JWT_SECRET", () => {
      const originalSecret = process.env.JWT_SECRET;

      vi.stubEnv("NODE_ENV", "production");
      delete process.env.JWT_SECRET;

      const service = new AuthService();
      expect(() => (service as unknown as { getJWTSecret: () => string }).getJWTSecret()).toThrow(
        /JWT_SECRET must be set in production/i,
      );

      vi.unstubAllEnvs();
      if (originalSecret) {
        process.env.JWT_SECRET = originalSecret;
      } else {
        delete process.env.JWT_SECRET;
      }
    });
  });

  describe("signup", () => {
    test("creates tenant and owner user and returns token", async () => {
      const signupData = createMockSignupData();

      const result = await authService.signup(signupData);

      expect(result.user).toBeDefined();
      expect(result.tenant).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.user.email).toBe(signupData.email);
      expect(result.user.firstName).toBe(signupData.firstName);
      expect(result.user.lastName).toBe(signupData.lastName);
      expect(result.user.role).toBe(UserRole.OWNER);
      expect(result.tenant.name).toBe(signupData.tenantName);
      expect(result.tenant.slug).toBe(signupData.tenantSlug);
    });

    test("persists tenant and user in database", async () => {
      const signupData = createMockSignupData();
      const result = await authService.signup(signupData);

      const userInDb = await prisma.user.findUnique({ where: { id: result.user.id } });
      const tenantInDb = await prisma.tenant.findUnique({ where: { id: result.tenant.id } });

      expect(userInDb).not.toBeNull();
      expect(tenantInDb).not.toBeNull();
      expect(userInDb?.tenantId).toBe(tenantInDb?.id);
    });

    test("stores hashed password instead of plaintext", async () => {
      const signupData = createMockSignupData();
      const result = await authService.signup(signupData);

      const userInDb = await prisma.user.findUnique({ where: { id: result.user.id } });

      expect(userInDb?.passwordHash).toBeTruthy();
      expect(userInDb?.passwordHash).not.toBe(signupData.password);
      expect(userInDb?.passwordHash?.startsWith("$2a$") || userInDb?.passwordHash?.startsWith("$2b$")).toBe(true);
    });

    test("returns a token that can be verified", async () => {
      const signupData = createMockSignupData();
      const result = await authService.signup(signupData);

      const payload = await authService.verifyToken(result.token);

      expect(payload.userId).toBe(result.user.id);
      expect(payload.tenantId).toBe(result.tenant.id);
      expect(payload.role).toBe(UserRole.OWNER);
    });

    test("sets user as active by default", async () => {
      const signupData = createMockSignupData();
      const result = await authService.signup(signupData);

      const userInDb = await prisma.user.findUnique({ where: { id: result.user.id } });

      expect(userInDb?.isActive).toBe(true);
    });

    test("throws when email already exists", async () => {
      const firstSignup = createMockSignupData({ email: "duplicate-email@example.com" });
      await authService.signup(firstSignup);

      const secondSignup = createMockSignupData({
        email: "duplicate-email@example.com",
        tenantSlug: `${firstSignup.tenantSlug}-other`,
      });

      await expect(authService.signup(secondSignup)).rejects.toThrow(/email|already exists|duplicate/i);
    });

    test("throws when tenant slug already exists", async () => {
      const firstSignup = createMockSignupData({ tenantSlug: "same-tenant-slug" });
      await authService.signup(firstSignup);

      const secondSignup = createMockSignupData({
        tenantSlug: "same-tenant-slug",
        email: "another-user@example.com",
      });

      await expect(authService.signup(secondSignup)).rejects.toThrow(/slug|tenant|already exists|duplicate/i);
    });

    test("handles concurrent signups with the same tenant slug gracefully", async () => {
      const baseSlug = `race-slug-${Date.now()}`;
      const first = createMockSignupData({
        tenantSlug: baseSlug,
        email: `race-1-${Date.now()}@example.com`,
      });
      const second = createMockSignupData({
        tenantSlug: baseSlug,
        email: `race-2-${Date.now()}@example.com`,
      });

      const results = await Promise.allSettled([authService.signup(first), authService.signup(second)]);

      const succeeded = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");
      expect(succeeded.length).toBe(1);
      expect(failed.length).toBe(1);
      expect((failed[0] as PromiseRejectedResult).reason.message).toMatch(/slug|already exists|duplicate/i);
    });

    test("throws when password is shorter than 8 characters", async () => {
      const signupData = createMockSignupData({ password: "Abc123!" });

      await expect(authService.signup(signupData)).rejects.toThrow(/8|password|characters/i);
    });

    test("throws when email format is invalid", async () => {
      const signupData = createMockSignupData({ email: "invalid-email-format" });

      await expect(authService.signup(signupData)).rejects.toThrow(/email|invalid format|validation/i);
    });

    test("throws when required fields are empty", async () => {
      const signupData = createMockSignupData({ firstName: "", tenantName: "" });

      await expect(authService.signup(signupData)).rejects.toThrow(/required|empty|invalid/i);
    });

    test("rolls back tenant creation if user creation fails", async () => {
      const constraintName = "auth_signup_force_user_create_failure";
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "${constraintName}"`);
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "User" ADD CONSTRAINT "${constraintName}" CHECK (email <> 'force-user-create-fail@example.com')`,
      );

      const signupData = createMockSignupData({
        email: "force-user-create-fail@example.com",
        tenantSlug: "rollback-tenant-slug",
      });

      try {
        await expect(authService.signup(signupData)).rejects.toThrow(/signup|user|create|constraint|check/i);

        const tenantInDb = await prisma.tenant.findUnique({ where: { slug: signupData.tenantSlug } });
        const userInDb = await prisma.user.findFirst({ where: { email: signupData.email } });

        expect(tenantInDb).toBeNull();
        expect(userInDb).toBeNull();
      } finally {
        await prisma.$executeRawUnsafe(`ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "${constraintName}"`);
      }
    });
  });

  describe("login", () => {
    test("returns user and token for valid credentials", async () => {
      const signupData = createMockSignupData({ email: "login-success@example.com" });
      await authService.signup(signupData);

      const result = await authService.login(signupData.email, signupData.password, signupData.tenantSlug);

      expect(result.user).toBeDefined();
      expect(result.tenant.slug).toBe(signupData.tenantSlug);
      expect(result.token).toBeDefined();
      expect(result.user.email).toBe(signupData.email);
    });

    test("returns user fields id email role tenantId firstName lastName", async () => {
      const signupData = createMockSignupData({ email: "login-fields@example.com" });
      await authService.signup(signupData);

      const result = await authService.login(signupData.email, signupData.password, signupData.tenantSlug);

      expect(result.user).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          email: signupData.email,
          role: UserRole.OWNER,
          tenantId: expect.any(String),
          firstName: signupData.firstName,
          lastName: signupData.lastName,
        }),
      );
    });

    test("returns token that can be verified", async () => {
      const signupData = createMockSignupData({ email: "login-token@example.com" });
      const signupResult = await authService.signup(signupData);

      const result = await authService.login(signupData.email, signupData.password, signupData.tenantSlug);
      const payload = await authService.verifyToken(result.token);

      expect(payload.userId).toBe(signupResult.user.id);
      expect(payload.tenantId).toBe(signupResult.tenant.id);
      expect(payload.role).toBe(UserRole.OWNER);
    });

    test("throws Invalid credentials when email is not found", async () => {
      const signupData = createMockSignupData({ email: "known-user-for-missing-check@example.com" });
      await authService.signup(signupData);

      await expect(authService.login("missing-user@example.com", "SomePassword123", signupData.tenantSlug)).rejects.toThrow(
        /invalid credentials/i,
      );
    });

    test("throws Invalid credentials when password is incorrect", async () => {
      const signupData = createMockSignupData({ email: "wrong-password@example.com" });
      await authService.signup(signupData);

      await expect(authService.login(signupData.email, "WrongPassword!99", signupData.tenantSlug)).rejects.toThrow(
        /invalid credentials/i,
      );
    });

    test("throws for inactive users", async () => {
      const signupData = createMockSignupData({ email: "inactive-login@example.com" });
      const signupResult = await authService.signup(signupData);

      await prisma.user.update({
        where: { id: signupResult.user.id },
        data: { isActive: false },
      });

      await expect(authService.login(signupData.email, signupData.password, signupData.tenantSlug)).rejects.toThrow(
        /inactive|deactivated|invalid credentials/i,
      );
    });

    test("does not reveal difference between unknown email and wrong password", async () => {
      const signupData = createMockSignupData({ email: "message-check@example.com" });
      await authService.signup(signupData);

      const unknownEmailError = await authService
        .login("missing-message-check@example.com", signupData.password, signupData.tenantSlug)
        .then(() => "")
        .catch((error: unknown) => (error instanceof Error ? error.message : String(error)));

      const wrongPasswordError = await authService
        .login(signupData.email, "DefinitelyWrongPassword", signupData.tenantSlug)
        .then(() => "")
        .catch((error: unknown) => (error instanceof Error ? error.message : String(error)));

      expect(unknownEmailError).toBeTruthy();
      expect(wrongPasswordError).toBeTruthy();
      expect(unknownEmailError.toLowerCase()).toBe(wrongPasswordError.toLowerCase());
      expect(unknownEmailError).toMatch(/invalid credentials/i);
    });

    test("fails if tenant slug does not exist", async () => {
      await expect(authService.login("owner@test.com", "password123", "nonexistent-slug")).rejects.toThrow(/tenant not found/i);
    });

    test("fails if user exists in a different tenant", async () => {
      const signupA = createMockSignupData({
        email: "cross-tenant-user@example.com",
        tenantSlug: `agency-a-${Date.now()}`,
      });
      await authService.signup(signupA);

      const signupB = createMockSignupData({
        email: "another-user@example.com",
        tenantSlug: `agency-b-${Date.now()}`,
      });
      await authService.signup(signupB);

      await expect(authService.login(signupA.email, signupA.password, signupB.tenantSlug)).rejects.toThrow(/invalid credentials/i);
    });

    test("succeeds when user exists in the correct tenant", async () => {
      const signupData = createMockSignupData({
        email: "tenant-aware-success@example.com",
        tenantSlug: `agency-x-${Date.now()}`,
      });
      await authService.signup(signupData);

      const result = await authService.login(signupData.email, signupData.password, signupData.tenantSlug);

      expect(result.user.email).toBe(signupData.email);
      expect(result.tenant.slug).toBe(signupData.tenantSlug);
    });
  });

  describe("getCurrentUser", () => {
    test("returns current user for valid token", async () => {
      const signupData = createMockSignupData({ email: "current-user@example.com" });
      const signupResult = await authService.signup(signupData);

      const user = await authService.getCurrentUser(signupResult.token);

      expect(user.id).toBe(signupResult.user.id);
      expect(user.email).toBe(signupData.email);
      expect(user.tenantId).toBe(signupResult.tenant.id);
    });

    test("includes tenant relation object", async () => {
      const signupData = createMockSignupData({ email: "with-tenant@example.com" });
      const signupResult = await authService.signup(signupData);

      const user = await authService.getCurrentUser(signupResult.token);

      expect(user.tenant).toEqual(
        expect.objectContaining({
          id: signupResult.tenant.id,
          name: signupData.tenantName,
          slug: signupData.tenantSlug,
        }),
      );
    });

    test("works with token generated from login", async () => {
      const signupData = createMockSignupData({ email: "from-login@example.com" });
      await authService.signup(signupData);

      const loginResult = await authService.login(signupData.email, signupData.password, signupData.tenantSlug);
      const user = await authService.getCurrentUser(loginResult.token);

      expect(user.email).toBe(signupData.email);
      expect(user.role).toBe(UserRole.OWNER);
    });

    test("throws when token is invalid", async () => {
      await expect(authService.getCurrentUser("invalid-token-value")).rejects.toThrow(/token|invalid|jwt/i);
    });

    test("throws when user from token does not exist", async () => {
      const ghostToken = await authService.generateToken("non-existent-user-id", "tenant-x", UserRole.PM);

      await expect(authService.getCurrentUser(ghostToken)).rejects.toThrow(/user not found|not found|invalid/i);
    });

    test("throws when user is inactive", async () => {
      const signupData = createMockSignupData({ email: "inactive-current@example.com" });
      const signupResult = await authService.signup(signupData);

      await prisma.user.update({
        where: { id: signupResult.user.id },
        data: { isActive: false },
      });

      await expect(authService.getCurrentUser(signupResult.token)).rejects.toThrow(/inactive|deactivated|unauthorized|forbidden/i);
    });
  });
});
