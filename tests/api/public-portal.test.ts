import request from "supertest";
import { describe, expect, it } from "vitest";
import { API_URL, createClient, createProject, createVersion, signupAndLogin } from "@/tests/api/helpers";

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
  it("GET /api/public/portal/[token] returns versions and active IN_REVIEW version", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    const project = await createProject(session.token, client.id);
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
    const client = await createClient(session.token);
    const project = await createProject(session.token, client.id);
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
    const client = await createClient(session.token);
    const project = await createProject(session.token, client.id);
    const version = await createVersion(session.token, project.id, { versionNo: 1 });
    const portalToken = await getProjectPortalToken(session.token, project.id);

    const response = await request(API_URL)
      .post(`/api/public/portal/${portalToken}/approve`)
      .send({ versionId: version.id });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("APPROVED");
  });

  it("POST /api/public/portal/[token]/approve rejects version from another project", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    const project1 = await createProject(session.token, client.id);
    const project2 = await createProject(session.token, client.id);
    const foreignVersion = await createVersion(session.token, project2.id, { versionNo: 1 });
    const portalToken = await getProjectPortalToken(session.token, project1.id);

    const response = await request(API_URL)
      .post(`/api/public/portal/${portalToken}/approve`)
      .send({ versionId: foreignVersion.id });

    expect(response.status).toBe(404);
  });

  it("POST /api/projects/[id]/portal-token/reset rotates token", async () => {
    const session = await signupAndLogin();
    const client = await createClient(session.token);
    const project = await createProject(session.token, client.id);

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
});
