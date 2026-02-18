import request from "supertest";
import { describe, expect, it } from "vitest";
import { API_URL, createClient, signupAndLogin } from "@/tests/api/helpers";

describe("API Clients", () => {
  it("GET /api/clients requires auth", async () => {
    const res = await request(API_URL).get("/api/clients");
    expect(res.status).toBe(401);
  });

  it("POST /api/clients creates client", async () => {
    const session = await signupAndLogin();
    const res = await request(API_URL).post("/api/clients").set("Authorization", `Bearer ${session.token}`).send({
      name: "Client One",
      email: `client-${Date.now()}@example.com`,
      companyName: "Client LLC",
    });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Client One");
  });

  it("GET /api/clients returns list", async () => {
    const session = await signupAndLogin();
    await createClient(session.token);
    const res = await request(API_URL).get("/api/clients").set("Authorization", `Bearer ${session.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("PATCH /api/clients/[id] updates client", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);

    const res = await request(API_URL)
      .patch(`/api/clients/${client.id}`)
      .set("Authorization", `Bearer ${session.token}`)
      .send({ name: "Renamed Client" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Renamed Client");
  });

  it("DELETE /api/clients/[id] deletes client", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);

    const removeRes = await request(API_URL)
      .delete(`/api/clients/${client.id}`)
      .set("Authorization", `Bearer ${session.token}`);
    expect(removeRes.status).toBe(200);

    const getRes = await request(API_URL).get(`/api/clients/${client.id}`).set("Authorization", `Bearer ${session.token}`);
    expect(getRes.status).toBe(404);
  });
});
