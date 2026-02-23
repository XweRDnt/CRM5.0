import request from "supertest";
import { describe, expect, it } from "vitest";
import { API_URL, createClient, createProject, signupAndLogin } from "@/tests/api/helpers";

describe("API Projects", () => {
  it("POST /api/projects requires auth", async () => {
    const res = await request(API_URL).post("/api/projects").send({ name: "NoAuth" });
    expect(res.status).toBe(401);
  });

  it("POST /api/projects validates payload", async () => {
    const session = await signupAndLogin();
    const res = await request(API_URL).post("/api/projects").set("Authorization", `Bearer ${session.token}`).send({
      name: "",
      clientId: "missing",
    });

    expect(res.status).toBe(400);
  });

  it("POST /api/projects creates project", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    const res = await request(API_URL).post("/api/projects").set("Authorization", `Bearer ${session.token}`).send({
      name: "Project Alpha",
      clientId: client.id,
      revisionsLimit: 3,
    });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Project Alpha");
    expect(typeof res.body.portalToken).toBe("string");
  });

  it("GET /api/projects returns list", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    await createProject(session.token, client.id);

    const res = await request(API_URL)
      .get("/api/projects?status=DRAFT")
      .set("Authorization", `Bearer ${session.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("PATCH /api/projects/[id] updates status", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    const project = await createProject(session.token, client.id);

    const res = await request(API_URL)
      .patch(`/api/projects/${project.id}`)
      .set("Authorization", `Bearer ${session.token}`)
      .send({ status: "IN_PROGRESS" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_PROGRESS");
  });

  it("DELETE /api/projects/[id] deletes project", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    const project = await createProject(session.token, client.id);

    const res = await request(API_URL).delete(`/api/projects/${project.id}`).set("Authorization", `Bearer ${session.token}`);
    expect(res.status).toBe(200);
  });
});
