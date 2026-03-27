import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { API_URL, createProject, createVersion, signupAndLogin } from "@/tests/api/helpers";
import { prisma } from "@/lib/utils/db";

async function getProjectPortalToken(token: string, projectId: string): Promise<string> {
  const response = await request(API_URL)
    .get(`/api/projects/${projectId}`)
    .set("Authorization", `Bearer ${token}`);

  if (response.status !== 200) {
    throw new Error(`Failed to load project (${response.status}): ${JSON.stringify(response.body)}`);
  }

  return response.body.portalToken as string;
}

describe("Public Portal API", () => {
  afterEach(() => {
    delete process.env.DEMO_PORTAL_TOKEN;
  });

  it("GET /api/public/portal/[token] returns versions and active IN_REVIEW version", async () => {
    const session = await signupAndLogin();
    const project = await createProject(session.token);
    const version1 = await createVersion(session.token, project.id, { versionNo: 1 });
    await createVersion(session.token, project.id, { versionNo: 2 });

    await request(API_URL)
      .patch(`/api/projects/${project.id}/versions/${version1.id}/status`)
      .set("Authorization", `Bearer ${session.token}`)
      .send({ status: "IN_REVIEW" });

    const portalToken = await getProjectPortalToken(session.token, project.id);
    const response = await request(API_URL).get(`/api/public/portal/${portalToken}`);

    expect(response.status).toBe(200);
    expect(response.body.versions.length).toBe(2);
    expect(response.body.activeVersionId).toBe(version1.id);
  });

  it("GET /api/public/portal/[token] supports versionId query", async () => {
    const session = await signupAndLogin();
    const project = await createProject(session.token);
    const version1 = await createVersion(session.token, project.id, { versionNo: 1 });
    const version2 = await createVersion(session.token, project.id, { versionNo: 2 });
    const portalToken = await getProjectPortalToken(session.token, project.id);

    const response = await request(API_URL).get(`/api/public/portal/${portalToken}?versionId=${version2.id}`);

    expect(response.status).toBe(200);
    expect(response.body.activeVersionId).toBe(version2.id);
    expect(response.body.versions.some((item: { id: string }) => item.id === version1.id)).toBe(true);
  });

  it("POST /api/public/portal/[token]/approve approves selected version", async () => {
    const session = await signupAndLogin();
    const project = await createProject(session.token);
    const version = await createVersion(session.token, project.id, { versionNo: 1 });
    const portalToken = await getProjectPortalToken(session.token, project.id);

    const response = await request(API_URL)
      .post(`/api/public/portal/${portalToken}/approve`)
      .send({ versionId: version.id });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("APPROVED");
  });

  it("POST /api/public/portal/[token]/approve rejects demo token writes", async () => {
    const session = await signupAndLogin();
    const project = await createProject(session.token);
    const version = await createVersion(session.token, project.id, { versionNo: 1 });
    const portalToken = await getProjectPortalToken(session.token, project.id);

    process.env.DEMO_PORTAL_TOKEN = portalToken;

    const response = await request(API_URL)
      .post(`/api/public/portal/${portalToken}/approve`)
      .send({ versionId: version.id });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("DEMO_READONLY");
  });

  it("POST /api/public/portal/[token]/approve rejects version from another project", async () => {
    const session = await signupAndLogin();
    const project1 = await createProject(session.token, "Portal Project 1");
    const project2 = await createProject(session.token, "Portal Project 2");
    const foreignVersion = await createVersion(session.token, project2.id, { versionNo: 1 });
    const portalToken = await getProjectPortalToken(session.token, project1.id);

    const response = await request(API_URL)
      .post(`/api/public/portal/${portalToken}/approve`)
      .send({ versionId: foreignVersion.id });

    expect(response.status).toBe(404);
  });

  it("POST /api/projects/[id]/portal-token/reset rotates token", async () => {
    const session = await signupAndLogin();
    const project = await createProject(session.token);

    const previousToken = await getProjectPortalToken(session.token, project.id);

    const resetResponse = await request(API_URL)
      .post(`/api/projects/${project.id}/portal-token/reset`)
      .set("Authorization", `Bearer ${session.token}`);

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.portalToken).toBeTruthy();
    expect(resetResponse.body.portalToken).not.toBe(previousToken);

    const oldPortalResponse = await request(API_URL).get(`/api/public/portal/${previousToken}`);
    expect(oldPortalResponse.status).toBe(404);

    const newPortalResponse = await request(API_URL).get(`/api/public/portal/${resetResponse.body.portalToken}`);
    expect(newPortalResponse.status).toBe(200);
  });

  it("POST /api/public/feedback rejects writes for the demo portal project", async () => {
    const session = await signupAndLogin();
    const project = await createProject(session.token);
    const version = await createVersion(session.token, project.id, { versionNo: 1 });
    const portalToken = await getProjectPortalToken(session.token, project.id);

    process.env.DEMO_PORTAL_TOKEN = portalToken;

    const response = await request(API_URL).post("/api/public/feedback").send({
      assetVersionId: version.id,
      authorType: "CLIENT",
      authorName: "Demo Viewer",
      text: "Read-only demo should reject this",
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("DEMO_READONLY");
  });

  it("POST /api/public/feedback/[id]/thread rejects replies for the demo token", async () => {
    const session = await signupAndLogin();
    const project = await createProject(session.token);
    const version = await createVersion(session.token, project.id, { versionNo: 1 });
    const portalToken = await getProjectPortalToken(session.token, project.id);

    const feedback = await prisma.feedbackItem.create({
      data: {
        assetVersionId: version.id,
        authorType: "CLIENT",
        authorName: "Client",
        text: "Existing feedback",
        status: "NEW",
      },
      select: { id: true },
    });

    process.env.DEMO_PORTAL_TOKEN = portalToken;

    const response = await request(API_URL).post(`/api/public/feedback/${feedback.id}/thread`).send({
      token: portalToken,
      authorName: "Demo Viewer",
      text: "Should fail in demo mode",
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("DEMO_READONLY");
  });

  it("POST /api/public/feedback/[id]/thread/read rejects read markers for the demo token", async () => {
    const session = await signupAndLogin();
    const project = await createProject(session.token);
    const version = await createVersion(session.token, project.id, { versionNo: 1 });
    const portalToken = await getProjectPortalToken(session.token, project.id);

    const feedback = await prisma.feedbackItem.create({
      data: {
        assetVersionId: version.id,
        authorType: "CLIENT",
        authorName: "Client",
        text: "Existing feedback",
        status: "NEW",
      },
      select: { id: true },
    });

    process.env.DEMO_PORTAL_TOKEN = portalToken;

    const response = await request(API_URL).post(`/api/public/feedback/${feedback.id}/thread/read`).send({
      token: portalToken,
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("DEMO_READONLY");
  });
});
