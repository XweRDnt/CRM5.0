import request from "supertest";
import { describe, expect, it } from "vitest";
import { API_URL, signupAndLogin } from "@/tests/api/helpers";

describe("API Auth", () => {
  it("POST /api/auth/signup creates account", async () => {
    const nonce = Date.now().toString(36);
    const res = await request(API_URL).post("/api/auth/signup").send({
      email: `signup-${nonce}@example.com`,
      password: "securePass123",
      firstName: "John",
      lastName: "Doe",
      tenantName: "Agency One",
      tenantSlug: `agency-${nonce}`,
    });

    expect([200, 201]).toContain(res.status);
    expect(res.body.token).toBeTypeOf("string");
  });

  it("POST /api/auth/signup validates payload", async () => {
    const res = await request(API_URL).post("/api/auth/signup").send({
      email: "not-an-email",
      password: "123",
    });

    expect(res.status).toBe(400);
  });

  it("POST /api/auth/login returns token", async () => {
    const session = await signupAndLogin();
    expect(session.token).toBeTypeOf("string");
  });

  it("POST /api/auth/login rejects invalid credentials", async () => {
    const res = await request(API_URL).post("/api/auth/login").send({
      email: "wrong@example.com",
      password: "wrong",
      tenantSlug: "missing",
    });

    expect([400, 404]).toContain(res.status);
  });

  it("GET /api/auth/me requires auth", async () => {
    const res = await request(API_URL).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/me returns current user", async () => {
    const session = await signupAndLogin();
    const res = await request(API_URL).get("/api/auth/me").set("Authorization", `Bearer ${session.token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(session.email);
  });
});
