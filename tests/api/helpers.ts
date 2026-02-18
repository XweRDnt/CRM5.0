import { randomUUID } from "node:crypto";
import request from "supertest";

export const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";

export type AuthSession = {
  token: string;
  email: string;
  password: string;
  tenantSlug: string;
};

export async function signupAndLogin(): Promise<AuthSession> {
  const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const email = `owner-${nonce}@example.com`;
  const password = "securePass123";
  const tenantSlug = `agency-${nonce}`;

  const signupResponse = await request(API_URL).post("/api/auth/signup").send({
    email,
    password,
    firstName: "Owner",
    lastName: "User",
    tenantName: `Agency ${nonce}`,
    tenantSlug,
  });

  if (![200, 201].includes(signupResponse.status)) {
    throw new Error(`Signup failed (${signupResponse.status}): ${JSON.stringify(signupResponse.body)}`);
  }

  const loginResponse = await request(API_URL).post("/api/auth/login").send({
    email,
    password,
    tenantSlug,
  });

  if (loginResponse.status !== 200 || !loginResponse.body.token) {
    throw new Error(`Login failed (${loginResponse.status}): ${JSON.stringify(loginResponse.body)}`);
  }

  return {
    token: loginResponse.body.token as string,
    email,
    password,
    tenantSlug,
  };
}

export async function createClient(token: string): Promise<{ id: string }> {
  const response = await request(API_URL)
    .post("/api/clients")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Client Test",
      email: `client-${randomUUID()}@example.com`,
      companyName: "ACME",
    });

  if (response.status !== 201) {
    throw new Error(`Client create failed (${response.status}): ${JSON.stringify(response.body)}`);
  }

  return response.body as { id: string };
}

export async function createProject(token: string, clientId: string): Promise<{ id: string }> {
  const response = await request(API_URL)
    .post("/api/projects")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: `Project ${Date.now()}`,
      clientId,
      revisionsLimit: 3,
    });

  if (response.status !== 201) {
    throw new Error(`Project create failed (${response.status}): ${JSON.stringify(response.body)}`);
  }

  return response.body as { id: string };
}

export async function createTask(token: string, projectId: string): Promise<{ id: string }> {
  const response = await request(API_URL)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${token}`)
    .send({
      projectId,
      title: "Cut intro",
      priority: "HIGH",
      category: "CONTENT",
    });

  if (response.status !== 201) {
    throw new Error(`Task create failed (${response.status}): ${JSON.stringify(response.body)}`);
  }

  return response.body as { id: string };
}

export async function createVersion(
  token: string,
  projectId: string,
  overrides?: Partial<{
    versionNo: number;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    durationSec: number;
    notes: string;
  }>,
): Promise<{ id: string; status: string }> {
  const response = await request(API_URL)
    .post(`/api/projects/${projectId}/versions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      versionNo: overrides?.versionNo ?? 1,
      fileUrl: overrides?.fileUrl ?? `https://example.com/video-${randomUUID()}.mp4`,
      fileName: overrides?.fileName ?? "video.mp4",
      fileSize: overrides?.fileSize ?? 10_000_000,
      durationSec: overrides?.durationSec ?? 120,
      notes: overrides?.notes ?? "Initial upload",
    });

  if (response.status !== 201) {
    throw new Error(`Version create failed (${response.status}): ${JSON.stringify(response.body)}`);
  }

  return response.body as { id: string; status: string };
}
