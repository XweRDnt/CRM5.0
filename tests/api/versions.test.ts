import request from "supertest";
import { describe, expect, it } from "vitest";
import { API_URL, createClient, createProject, createVersion, signupAndLogin } from "@/tests/api/helpers";

describe("API Version Control", () => {
  it("PATCH /api/projects/[id]/versions/[versionId]/status requires auth", async () => {
    const res = await request(API_URL).patch("/api/projects/p1/versions/v1/status").send({ status: "IN_REVIEW" });
    expect(res.status).toBe(401);
  });

  it("PATCH /api/projects/[id]/versions/[versionId]/status updates status", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    const project = await createProject(session.token, client.id);
    const version = await createVersion(session.token, project.id);

    const res = await request(API_URL)
      .patch(`/api/projects/${project.id}/versions/${version.id}/status`)
      .set("Authorization", `Bearer ${session.token}`)
      .send({ status: "IN_REVIEW" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_REVIEW");
  });

  it("PATCH /api/projects/[id]/versions/[versionId]/status validates transition", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    const project = await createProject(session.token, client.id);
    const version = await createVersion(session.token, project.id);

    const res = await request(API_URL)
      .patch(`/api/projects/${project.id}/versions/${version.id}/status`)
      .set("Authorization", `Bearer ${session.token}`)
      .send({ status: "APPROVED" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid status transition");
  });

  it("PATCH /api/projects/[id]/versions/[versionId]/status supports CHANGES_REQUESTED -> IN_REVIEW", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    const project = await createProject(session.token, client.id);
    const version = await createVersion(session.token, project.id);

    await request(API_URL)
      .patch(`/api/projects/${project.id}/versions/${version.id}/status`)
      .set("Authorization", `Bearer ${session.token}`)
      .send({ status: "IN_REVIEW" });

    await request(API_URL)
      .patch(`/api/projects/${project.id}/versions/${version.id}/status`)
      .set("Authorization", `Bearer ${session.token}`)
      .send({ status: "CHANGES_REQUESTED" });

    const res = await request(API_URL)
      .patch(`/api/projects/${project.id}/versions/${version.id}/status`)
      .set("Authorization", `Bearer ${session.token}`)
      .send({ status: "IN_REVIEW" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_REVIEW");
  });

  it("PATCH /api/projects/[id]/versions/[versionId]/status validates payload", async () => {
    const session = await signupAndLogin();

    const res = await request(API_URL)
      .patch("/api/projects/p1/versions/v1/status")
      .set("Authorization", `Bearer ${session.token}`)
      .send({ status: "UNKNOWN" });

    expect(res.status).toBe(400);
  });

  it("POST /api/projects/[id]/versions/[versionId]/approve requires auth", async () => {
    const res = await request(API_URL).post("/api/projects/p1/versions/v1/approve");
    expect(res.status).toBe(401);
  });

  it("POST /api/projects/[id]/versions/[versionId]/approve approves version", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    const project = await createProject(session.token, client.id);
    const version = await createVersion(session.token, project.id);

    await request(API_URL)
      .patch(`/api/projects/${project.id}/versions/${version.id}/status`)
      .set("Authorization", `Bearer ${session.token}`)
      .send({ status: "IN_REVIEW" });

    const res = await request(API_URL)
      .post(`/api/projects/${project.id}/versions/${version.id}/approve`)
      .set("Authorization", `Bearer ${session.token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
    expect(typeof res.body.approvedBy).toBe("string");
    expect(res.body.approvedAt).toBeTruthy();
  });

  it("POST /api/projects/[id]/versions/[versionId]/approve works from DRAFT", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    const project = await createProject(session.token, client.id);
    const version = await createVersion(session.token, project.id);

    const res = await request(API_URL)
      .post(`/api/projects/${project.id}/versions/${version.id}/approve`)
      .set("Authorization", `Bearer ${session.token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
  });

  it("POST /api/projects/[id]/versions/[versionId]/approve returns 404 for unknown version", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    const project = await createProject(session.token, client.id);

    const res = await request(API_URL)
      .post(`/api/projects/${project.id}/versions/does-not-exist/approve`)
      .set("Authorization", `Bearer ${session.token}`);

    expect(res.status).toBe(404);
  });
});
