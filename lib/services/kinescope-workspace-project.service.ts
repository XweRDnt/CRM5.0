import { prisma } from "@/lib/utils/db";
import { APIError } from "@/lib/utils/api-error";

type KinescopeProjectItem = {
  id?: string;
  name?: string;
  title?: string;
};

type KinescopeProjectPrivacyType = "anywhere" | "nowhere" | "custom";

function normalizeProjectName(workspaceId: string): string {
  return `workspace-${workspaceId}`;
}

function resolveProjectPrivacyType(): KinescopeProjectPrivacyType {
  const raw = (process.env.KINESCOPE_PROJECT_PRIVACY_TYPE ?? "anywhere").trim().toLowerCase();

  // Backward compatibility with the legacy invalid value used before this fix.
  if (raw === "all") {
    return "anywhere";
  }

  if (raw === "anywhere" || raw === "nowhere" || raw === "custom") {
    return raw;
  }

  return "anywhere";
}

function readProjectId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.id,
    record.project_id,
    (record.data as Record<string, unknown> | undefined)?.id,
    (record.project as Record<string, unknown> | undefined)?.id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

function extractProjectItems(payload: unknown): KinescopeProjectItem[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const candidates = [record.data, record.items, record.projects];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) {
      continue;
    }
    return candidate.filter((item): item is KinescopeProjectItem => Boolean(item) && typeof item === "object");
  }

  return [];
}

export class KinescopeWorkspaceProjectService {
  private readonly baseUrl: string;
  private readonly apiToken: string;
  private readonly projectPrivacyType: KinescopeProjectPrivacyType;

  constructor() {
    this.baseUrl = (process.env.KINESCOPE_BASE_URL ?? "https://api.kinescope.io/v1").replace(/\/+$/, "");
    this.apiToken = (process.env.KINESCOPE_API_TOKEN ?? "").trim();
    this.projectPrivacyType = resolveProjectPrivacyType();
  }

  async ensureWorkspaceProjectForTenant(tenantId: string): Promise<string> {
    const workspace = await prisma.workspace.findUnique({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        kinescopeProjectId: true,
      },
    });

    if (!workspace) {
      throw new APIError(404, "Workspace not found", "NOT_FOUND");
    }

    if (workspace.kinescopeProjectId) {
      return workspace.kinescopeProjectId;
    }

    if (!this.apiToken) {
      throw new APIError(400, "Kinescope is not configured: KINESCOPE_API_TOKEN is required", "BAD_REQUEST");
    }

    const projectName = normalizeProjectName(workspace.id);
    const existingProjectId = await this.findProjectIdByName(projectName);
    const projectId = existingProjectId ?? (await this.createProject(projectName, workspace.name));

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        kinescopeProjectId: projectId,
        kinescopeProjectName: projectName,
        kinescopeProjectProvisionedAt: new Date(),
        billingTrackingStartedAt: new Date(),
      },
    });

    return projectId;
  }

  private async findProjectIdByName(name: string): Promise<string | null> {
    const response = await fetch(`${this.baseUrl}/projects?per_page=100&page=1`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => null)) as unknown;
    const projects = extractProjectItems(payload);
    const match = projects.find((project) => {
      const candidate = project.name ?? project.title ?? "";
      return candidate.trim().toLowerCase() === name.toLowerCase();
    });

    return match?.id?.trim() || null;
  }

  private async createProject(projectName: string, workspaceName: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/projects`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: projectName,
        privacy_type: this.projectPrivacyType,
        description: `Workspace: ${workspaceName}`,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new APIError(
        502,
        `Failed to provision Kinescope project for workspace (${response.status}): ${body || response.statusText}`,
        "UPSTREAM_ERROR",
      );
    }

    const payload = (await response.json().catch(() => null)) as unknown;
    const projectId = readProjectId(payload);
    if (!projectId) {
      throw new APIError(502, "Kinescope create project response does not include project id", "UPSTREAM_ERROR");
    }

    return projectId;
  }
}

export const kinescopeWorkspaceProjectService = new KinescopeWorkspaceProjectService();
