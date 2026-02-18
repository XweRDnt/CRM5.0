import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { API_URL, createClient, createProject, createTask, signupAndLogin } from "@/tests/api/helpers";

describe("API Tasks", () => {
  it("GET /api/tasks requires auth", async () => {
    const res = await request(API_URL).get("/api/tasks");
    expect(res.status).toBe(401);
  });

  it("POST /api/tasks creates task", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    const project = await createProject(session.token, client.id);

    const res = await request(API_URL).post("/api/tasks").set("Authorization", `Bearer ${session.token}`).send({
      projectId: project.id,
      title: "Fix lower third",
      priority: "MEDIUM",
      category: "DESIGN",
    });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Fix lower third");
  });

  it("GET /api/tasks lists tasks with filters", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    const project = await createProject(session.token, client.id);
    await createTask(session.token, project.id);

    const res = await request(API_URL)
      .get(`/api/tasks?projectId=${project.id}&status=TODO`)
      .set("Authorization", `Bearer ${session.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("PATCH /api/tasks/[id] updates task status", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    const project = await createProject(session.token, client.id);
    const task = await createTask(session.token, project.id);

    const res = await request(API_URL)
      .patch(`/api/tasks/${task.id}`)
      .set("Authorization", `Bearer ${session.token}`)
      .send({ status: "DONE" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("DONE");
  });

  it("DELETE /api/tasks/[id] removes task", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    const project = await createProject(session.token, client.id);
    const task = await createTask(session.token, project.id);

    const res = await request(API_URL).delete(`/api/tasks/${task.id}`).set("Authorization", `Bearer ${session.token}`);
    expect(res.status).toBe(200);
  });

  it("POST /api/tasks/from-feedback validates payload", async () => {
    const session = await signupAndLogin();
    const res = await request(API_URL)
      .post("/api/tasks/from-feedback")
      .set("Authorization", `Bearer ${session.token}`)
      .send({
        projectId: "",
        feedbackIds: [randomUUID()],
      });

    expect(res.status).toBe(400);
  });
});
