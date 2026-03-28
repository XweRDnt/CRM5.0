import { ProjectStatus as PrismaProjectStatus, VideoProvider } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { WorkflowService } from "@/lib/services/workflow.service";
import { getKinescopeService } from "@/lib/services/kinescope.service";
import { generatePortalProjectToken } from "@/lib/utils/portal-token";
import { ProjectStatus } from "@/types";
import type { JWTPayload } from "@/types";
import { buildAccessibleProjectsWhere, isOwnerOrPm } from "@/lib/services/access-control.service";
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
    scopeDocUrl: string | null;
    maxRevisions: number;
    currentRevisionCount: number;
    versions?: Array<{
      status: ProjectResponse["latestVersionStatus"];
      feedbackItems?: Array<{ id: string }>;
    }>;
    createdAt: Date;
    updatedAt: Date;
  }): ProjectResponse {
    const latestVersion = project.versions?.[0];

    return {
      id: project.id,
      tenantId: project.tenantId,
      portalToken: project.portalToken,
      name: project.name,
      description: project.description,
      status: toAppProjectStatus(project.status),
      brief: project.scopeDocUrl,
      revisionsLimit: project.maxRevisions,
      revisionsUsed: project.currentRevisionCount,
      latestVersionStatus: latestVersion?.status ?? null,
      latestVersionHasClientFeedback: (latestVersion?.feedbackItems?.length ?? 0) > 0,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  async createProject(input: CreateProjectInput): Promise<ProjectResponse> {
    const tenantId = input.tenantId?.trim();
    const name = input.name?.trim();
    const revisionsLimit = input.revisionsLimit ?? 3;

    if (!tenantId) {
      throw new Error("tenantId is required");
    }
    if (!name || name.length < 1 || name.length > 200) {
      throw new Error("Name must be between 1 and 200 characters");
    }
    if (revisionsLimit < 1) {
      throw new Error("revisionsLimit must be greater than or equal to 1");
    }

    const created = await prisma.project.create({
      data: {
        tenantId,
        portalToken: generatePortalProjectToken(),
        name,
        description: input.description ?? null,
        scopeDocUrl: input.brief ?? null,
        status: PrismaProjectStatus.DRAFT,
        maxRevisions: revisionsLimit,
        currentRevisionCount: 0,
      },
    });

    await this.workflowService.createDefaultStages({
      projectId: created.id,
      tenantId,
    });

    return this.mapProjectResponse(created);
  }

  async getProjectById(projectId: string, tenantId: string, user?: JWTPayload): Promise<ProjectResponse> {
    if (!tenantId || tenantId.trim().length === 0) {
      throw new Error("tenantId is required");
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...(user ? buildAccessibleProjectsWhere(user) : { tenantId }),
      },
      include: {
        versions: {
          orderBy: { versionNo: "desc" },
          take: 1,
          select: {
            status: true,
            feedbackItems: {
              where: { authorType: "CLIENT" },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!project) {
      throw new Error("Project not found");
    }

    return this.mapProjectResponse(project);
  }

  async listProjects(tenantId: string, filters?: ProjectFilters, user?: JWTPayload): Promise<ProjectResponse[]> {
    if (!tenantId || tenantId.trim().length === 0) {
      throw new Error("tenantId is required");
    }

    const projects = await prisma.project.findMany({
      where: {
        ...(user ? buildAccessibleProjectsWhere(user) : { tenantId }),
        status: filters?.status ? toPrismaProjectStatus(filters.status) : undefined,
      },
      orderBy: { createdAt: "desc" },
      include: {
        versions: {
          orderBy: { versionNo: "desc" },
          take: 1,
          select: {
            status: true,
            feedbackItems: {
              where: { authorType: "CLIENT" },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    return projects.map((project) => this.mapProjectResponse(project));
  }

  async rotatePortalToken(projectId: string, tenantId: string, user?: JWTPayload): Promise<{ portalToken: string }> {
    if (!tenantId || tenantId.trim().length === 0) {
      throw new Error("tenantId is required");
    }

    if (user && !isOwnerOrPm(user.role)) {
      throw new Error("Forbidden");
    }

    const updated = await prisma.project.updateMany({
      where: {
        id: projectId,
        ...(user ? buildAccessibleProjectsWhere(user) : { tenantId }),
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
        ...(user ? buildAccessibleProjectsWhere(user) : { tenantId }),
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

  async deleteProject(context: ServiceContext, input: { projectId: string; user?: JWTPayload }): Promise<void> {
    const tenantId = context.tenantId?.trim();
    const projectId = input.projectId?.trim();

    if (!tenantId) {
      throw new Error("tenantId is required");
    }
    if (!projectId) {
      throw new Error("projectId is required");
    }

    const accessWhere = input.user ? buildAccessibleProjectsWhere(input.user) : { tenantId };

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...accessWhere,
      },
      select: { id: true },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    const versions = await prisma.assetVersion.findMany({
      where: {
        projectId,
        videoProvider: VideoProvider.KINESCOPE,
        kinescopeVideoId: { not: null },
        project: {
          tenantId,
        },
      },
      select: {
        id: true,
        kinescopeVideoId: true,
      },
    });

    for (const version of versions) {
      if (!version.kinescopeVideoId) {
        continue;
      }

      try {
        await getKinescopeService().deleteVideo(version.kinescopeVideoId);
      } catch (error) {
        console.error("Failed to delete Kinescope video for project", {
          projectId,
          versionId: version.id,
          kinescopeVideoId: version.kinescopeVideoId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const deleted = await prisma.project.deleteMany({
      where: {
        id: projectId,
        ...accessWhere,
      },
    });

    if (deleted.count === 0) {
      throw new Error("Project not found");
    }
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
