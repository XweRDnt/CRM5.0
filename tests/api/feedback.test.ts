import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { API_URL, signupAndLogin } from "@/tests/api/helpers";

describe("API Feedback", () => {
  it("POST /api/feedback requires auth", async () => {
    const res = await request(API_URL).post("/api/feedback").send({
      text: "No auth",
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/feedback validates body", async () => {
    const session = await signupAndLogin();
    const res = await request(API_URL).post("/api/feedback").set("Authorization", `Bearer ${session.token}`).send({
      text: "",
    });

    expect(res.status).toBe(400);
  });

  it("PATCH /api/feedback/[id] returns 404 for unknown feedback id", async () => {
    const session = await signupAndLogin();
    const res = await request(API_URL)
      .patch("/api/feedback/not-a-uuid")
      .set("Authorization", `Bearer ${session.token}`)
      .send({ status: "RESOLVED" });

    expect(res.status).toBe(404);
  });

  it("DELETE /api/feedback/[id] returns 404 for unknown feedback", async () => {
    const session = await signupAndLogin();
    const res = await request(API_URL)
      .delete(`/api/feedback/${randomUUID()}`)
      .set("Authorization", `Bearer ${session.token}`);

    expect(res.status).toBe(404);
  });
});
