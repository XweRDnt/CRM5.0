import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/utils/db";
import { API_URL, createClient, createProject, createVersion, signupAndLogin } from "@/tests/api/helpers";

async function createUploadSession(projectId: string, kinescopeVideoId: string, fileName: string, fileSize: number) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { tenantId: true },
  });
  if (!project) {
    throw new Error(`Project not found for upload session (${projectId})`);
  }
  await prisma.videoUploadSession.create({
    data: {
      tenantId: project.tenantId,
      projectId,
      kinescopeVideoId,
      fileName,
      fileType: "video/mp4",
      fileSize,
    },
  });
}

describe("API Version Control", () => {
  it("GET /api/projects/[id]/versions/meta returns used versions and next number", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    const project = await createProject(session.token, client.id);
    await createVersion(session.token, project.id, { versionNo: 1 });
    await createVersion(session.token, project.id, { versionNo: 2 });

    const res = await request(API_URL)
      .get(`/api/projects/${project.id}/versions/meta`)
      .set("Authorization", `Bearer ${session.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      usedVersionNumbers: [1, 2],
      nextVersionNumber: 3,
    });
  });

  it("GET /api/projects/[id]/versions/meta enforces project access", async () => {
    const ownerSession = await signupAndLogin();
    const foreignSession = await signupAndLogin();
    const client = await createClient(ownerSession.token);
    const project = await createProject(ownerSession.token, client.id);

    const res = await request(API_URL)
      .get(`/api/projects/${project.id}/versions/meta`)
      .set("Authorization", `Bearer ${foreignSession.token}`);

    expect(res.status).toBe(404);
  });

  it("POST /api/projects/[id]/versions auto-assigns version number when omitted", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    const project = await createProject(session.token, client.id);
    const kinescopeVideoId1 = "video_auto_1";
    const kinescopeVideoId2 = "video_auto_2";

    await createUploadSession(project.id, kinescopeVideoId1, "video-1.mp4", 10_000_000);
    await createUploadSession(project.id, kinescopeVideoId2, "video-2.mp4", 10_000_000);

    const first = await request(API_URL)
      .post(`/api/projects/${project.id}/versions`)
      .set("Authorization", `Bearer ${session.token}`)
      .send({
        fileUrl: `https://example.com/video-${Date.now()}-1.mp4`,
        fileName: "video-1.mp4",
        fileSize: 10_000_000,
        kinescopeVideoId: kinescopeVideoId1,
      });

    const second = await request(API_URL)
      .post(`/api/projects/${project.id}/versions`)
      .set("Authorization", `Bearer ${session.token}`)
      .send({
        fileUrl: `https://example.com/video-${Date.now()}-2.mp4`,
        fileName: "video-2.mp4",
        fileSize: 10_000_000,
        kinescopeVideoId: kinescopeVideoId2,
      });

    expect(first.status).toBe(201);
    expect(first.body.versionNumber).toBe(1);
    expect(second.status).toBe(201);
    expect(second.body.versionNumber).toBe(2);
  });

  it("POST /api/projects/[id]/versions returns suggestedVersionNo on version conflict", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    const project = await createProject(session.token, client.id);
    await createVersion(session.token, project.id, { versionNo: 1 });
    const kinescopeVideoId = "video_conflict";

    await createUploadSession(project.id, kinescopeVideoId, "video-duplicate.mp4", 10_000_000);

    const res = await request(API_URL)
      .post(`/api/projects/${project.id}/versions`)
      .set("Authorization", `Bearer ${session.token}`)
      .send({
        versionNo: 1,
        fileUrl: `https://example.com/video-${Date.now()}-duplicate.mp4`,
        fileName: "video-duplicate.mp4",
        fileSize: 10_000_000,
        kinescopeVideoId,
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Version already exists");
    expect(res.body.suggestedVersionNo).toBe(2);
  });

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
