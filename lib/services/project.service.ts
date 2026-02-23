import { ProjectStatus as PrismaProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { WorkflowService } from "@/lib/services/workflow.service";
import { generatePortalProjectToken } from "@/lib/utils/portal-token";
import { ProjectStatus } from "@/types";
import type {
  CreateProjectInput,
  ProjectFilters,
  ProjectResponse,
  ServiceContext,
} from "@/types";

const toPrismaProjectStatus = (status: ProjectStatus): PrismaProjectStatus => {
  switch (status) {
    case ProjectStatus.DRAFT:
      return PrismaProjectStatus.DRAFT;
    case ProjectStatus.IN_PROGRESS:
      return PrismaProjectStatus.IN_PROGRESS;
    case ProjectStatus.CLIENT_REVIEW:
      return PrismaProjectStatus.CLIENT_REVIEW;
    case ProjectStatus.COMPLETED:
      return PrismaProjectStatus.COMPLETED;
    case ProjectStatus.ON_HOLD:
      return PrismaProjectStatus.ON_HOLD;
    case ProjectStatus.CANCELLED:
      return PrismaProjectStatus.CANCELLED;
    default:
      return PrismaProjectStatus.DRAFT;
  }
};

const toAppProjectStatus = (status: PrismaProjectStatus): ProjectStatus => {
  switch (status) {
    case PrismaProjectStatus.DRAFT:
      return ProjectStatus.DRAFT;
    case PrismaProjectStatus.IN_PROGRESS:
      return ProjectStatus.IN_PROGRESS;
    case PrismaProjectStatus.CLIENT_REVIEW:
      return ProjectStatus.CLIENT_REVIEW;
    case PrismaProjectStatus.COMPLETED:
      return ProjectStatus.COMPLETED;
    case PrismaProjectStatus.ON_HOLD:
      return ProjectStatus.ON_HOLD;
    case PrismaProjectStatus.CANCELLED:
      return ProjectStatus.CANCELLED;
    default:
      return ProjectStatus.DRAFT;
  }
};

export class ProjectService {
  private readonly workflowService = new WorkflowService(prisma);

  private mapProjectResponse(project: {
    id: string;
    tenantId: string;
    portalToken: string;
    name: string;
    description: string | null;
    status: PrismaProjectStatus;
    clientAccountId: string;
    scopeDocUrl: string | null;
    maxRevisions: number;
    currentRevisionCount: number;
    createdAt: Date;
    updatedAt: Date;
    client: {
      id: string;
      contactName: string;
      email: string;
    };
  }): ProjectResponse {
    return {
      id: project.id,
      tenantId: project.tenantId,
      portalToken: project.portalToken,
      name: project.name,
      description: project.description,
      status: toAppProjectStatus(project.status),
      clientId: project.clientAccountId,
      client: {
        id: project.client.id,
        name: project.client.contactName,
        email: project.client.email,
      },
      brief: project.scopeDocUrl,
      revisionsLimit: project.maxRevisions,
      revisionsUsed: project.currentRevisionCount,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  async createProject(input: CreateProjectInput): Promise<ProjectResponse> {
    const tenantId = input.tenantId?.trim();
    const name = input.name?.trim();
    const clientId = input.clientId?.trim();
    const revisionsLimit = input.revisionsLimit ?? 3;

    if (!tenantId) {
      throw new Error("tenantId is required");
    }
    if (!name || name.length < 1 || name.length > 200) {
      throw new Error("Name must be between 1 and 200 characters");
    }
    if (!clientId) {
      throw new Error("clientId is required");
    }
    if (revisionsLimit < 1) {
      throw new Error("revisionsLimit must be greater than or equal to 1");
    }

    const client = await prisma.clientAccount.findFirst({
      where: {
        id: clientId,
        tenantId,
      },
      select: { id: true },
    });
    if (!client) {
      throw new Error("Client not found in this tenant");
    }

    const created = await prisma.project.create({
      data: {
        tenantId,
        clientAccountId: clientId,
        portalToken: generatePortalProjectToken(),
        name,
        description: input.description ?? null,
        scopeDocUrl: input.brief ?? null,
        status: PrismaProjectStatus.DRAFT,
        maxRevisions: revisionsLimit,
        currentRevisionCount: 0,
      },
      include: {
        client: {
          select: {
            id: true,
            contactName: true,
            email: true,
          },
        },
      },
    });

    await this.workflowService.createDefaultStages({
      projectId: created.id,
      tenantId,
    });

    return this.mapProjectResponse(created);
  }

  async getProjectById(projectId: string, tenantId: string): Promise<ProjectResponse> {
    if (!tenantId || tenantId.trim().length === 0) {
      throw new Error("tenantId is required");
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId,
      },
      include: {
        client: {
          select: {
            id: true,
            contactName: true,
            email: true,
          },
        },
      },
    });
    if (!project) {
      throw new Error("Project not found");
    }

    return this.mapProjectResponse(project);
  }

  async listProjects(tenantId: string, filters?: ProjectFilters): Promise<ProjectResponse[]> {
    if (!tenantId || tenantId.trim().length === 0) {
      throw new Error("tenantId is required");
    }

    const projects = await prisma.project.findMany({
      where: {
        tenantId,
        clientAccountId: filters?.clientId,
        status: filters?.status ? toPrismaProjectStatus(filters.status) : undefined,
      },
      include: {
        client: {
          select: {
            id: true,
            contactName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return projects.map((project) => this.mapProjectResponse(project));
  }

  async rotatePortalToken(projectId: string, tenantId: string): Promise<{ portalToken: string }> {
    if (!tenantId || tenantId.trim().length === 0) {
      throw new Error("tenantId is required");
    }

    const updated = await prisma.project.updateMany({
      where: {
        id: projectId,
        tenantId,
      },
      data: {
        portalToken: generatePortalProjectToken(),
      },
    });

    if (updated.count === 0) {
      throw new Error("Project not found");
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId,
      },
      select: {
        portalToken: true,
      },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    return { portalToken: project.portalToken };
  }

  async updateProject(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }

  async deleteProject(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }

  async updateStatus(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }

  async addProjectMember(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }

  async removeProjectMember(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }
}

export const projectService = new ProjectService();
