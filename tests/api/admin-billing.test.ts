import request from "supertest";
import { describe, expect, it } from "vitest";
import { API_URL, signupAndLogin } from "@/tests/api/helpers";

describe("API Admin Billing", () => {
  it("denies /api/admin/plans for non-admin user", async () => {
    const session = await signupAndLogin();
    process.env.PLATFORM_ADMIN_EMAILS = "admin-only@example.com";

    const res = await request(API_URL).get("/api/admin/plans").set("Authorization", `Bearer ${session.token}`);
    expect(res.status).toBe(403);
  });

  it("allows admin to list plans and update workspace subscription", async () => {
    const admin = await signupAndLogin();
    process.env.PLATFORM_ADMIN_EMAILS = admin.email;

    const plansRes = await request(API_URL).get("/api/admin/plans").set("Authorization", `Bearer ${admin.token}`);
    expect(plansRes.status).toBe(200);
    expect(Array.isArray(plansRes.body)).toBe(true);
    expect(plansRes.body.some((plan: { code: string }) => plan.code === "FREE")).toBe(true);

    const workspacesRes = await request(API_URL).get("/api/admin/workspaces").set("Authorization", `Bearer ${admin.token}`);
    expect(workspacesRes.status).toBe(200);
    const workspace = (workspacesRes.body as Array<{ workspaceId: string; owner: { email: string } }>).find(
      (item) => item.owner.email === admin.email,
    );
    expect(workspace).toBeTruthy();

    const paymentAt = new Date().toISOString();
    const updateRes = await request(API_URL)
      .patch(`/api/admin/workspaces/${workspace?.workspaceId}/subscription`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        planCode: "START",
        paymentAmountMinor: 290000,
        paymentCurrency: "RUB",
        paymentAt,
        paymentComment: "Manual bank transfer",
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.plan.code).toBe("START");

    const detailRes = await request(API_URL)
      .get(`/api/admin/workspaces/${workspace?.workspaceId}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.subscription.plan.code).toBe("START");
  });
});

