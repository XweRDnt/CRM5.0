import { randomUUID } from "node:crypto";
import request from "supertest";
import { prisma } from "@/lib/utils/db";

export const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";

export type AuthSession = {
  token: string;
  email: string;
  password: string;
  tenantSlug?: string;
};

export async function signupAndLogin(): Promise<AuthSession> {
  const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const email = `owner-${nonce}@example.com`;
  const password = "securePass123";
  const signupResponse = await request(API_URL).post("/api/auth/signup").send({
    email,
    password,
    workspaceName: `Agency ${nonce}`,
  });

  if (![200, 201].includes(signupResponse.status)) {
    throw new Error(`Signup failed (${signupResponse.status}): ${JSON.stringify(signupResponse.body)}`);
  }

  const loginResponse = await request(API_URL).post("/api/auth/login").send({
    email,
    password,
  });

  if (loginResponse.status !== 200 || !loginResponse.body.token) {
    throw new Error(`Login failed (${loginResponse.status}): ${JSON.stringify(loginResponse.body)}`);
  }

  return {
    token: loginResponse.body.token as string,
    email,
    password,
  };
}

export async function createClient(_token: string): Promise<{ id: string }> {
  return { id: "client-removed" };
}

export async function createProject(token: string, legacyClientIdOrName?: string, maybeName?: string): Promise<{ id: string }> {
  const name =
    maybeName ??
    (legacyClientIdOrName && !legacyClientIdOrName.startsWith("client-") ? legacyClientIdOrName : undefined) ??
    `Project ${Date.now()}`;

  const response = await request(API_URL)
    .post("/api/projects")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name,
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
    title: string;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    durationSec: number;
    notes: string;
    kinescopeVideoId: string;
  }>,
): Promise<{ id: string; status: string }> {
  const kinescopeVideoId = overrides?.kinescopeVideoId ?? `video_${randomUUID()}`;
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
      fileName: overrides?.fileName ?? "video.mp4",
      fileType: "video/mp4",
      fileSize: overrides?.fileSize ?? 10_000_000,
    },
  });

  const response = await request(API_URL)
    .post(`/api/projects/${projectId}/versions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      versionNo: overrides?.versionNo,
      title: overrides?.title,
      fileUrl: overrides?.fileUrl ?? `https://example.com/video-${randomUUID()}.mp4`,
      fileName: overrides?.fileName ?? "video.mp4",
      fileSize: overrides?.fileSize ?? 10_000_000,
      durationSec: overrides?.durationSec ?? 120,
      notes: overrides?.notes ?? "Initial upload",
      kinescopeVideoId,
    });

  if (response.status !== 201) {
    throw new Error(`Version create failed (${response.status}): ${JSON.stringify(response.body)}`);
  }

  return response.body as { id: string; status: string };
}
