import type { Prisma, PrismaClient, WorkflowStageName } from "@prisma/client";
import {
  type CompleteProjectInput,
  type CreateDefaultStagesInput,
  type StageMetrics,
  type TransitionToStageInput,
  type WorkflowStageResponse,
} from "@/types";
import { prisma as defaultPrisma } from "@/lib/utils/db";
import { DEFAULT_STAGE_SLA, STAGE_ORDER } from "@/lib/constants/workflow";

type StageWithOwner = Prisma.WorkflowStageGetPayload<{
  include: {
    owner: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
      };
    };
  };
}>;

const stageOwnerInclude = {
  owner: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
} as const;

export class WorkflowService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async createDefaultStages(input: CreateDefaultStagesInput): Promise<WorkflowStageResponse[]> {
    const { projectId, tenantId } = input;

    await this.assertProjectInTenant(projectId, tenantId);

    const existing = await this.prisma.workflowStage.findFirst({
      where: { projectId },
      select: { id: true },
    });

    if (existing) {
      throw new Error("Workflow stages already exist for this project");
    }

    const now = new Date();

    const createdStages = await this.prisma.$transaction(
      STAGE_ORDER.map((stageName, index) =>
        this.prisma.workflowStage.create({
          data: {
            projectId,
            stageName,
            slaHours: DEFAULT_STAGE_SLA[stageName],
            startedAt: index === 0 ? now : null,
            completedAt: null,
            ownerUserId: null,
          },
          include: stageOwnerInclude,
        }),
      ),
    );

    return createdStages.map((stage) => this.mapStageResponse(stage));
  }

  async getCurrentStage(projectId: string, tenantId: string): Promise<WorkflowStageResponse | null> {
    await this.assertProjectInTenant(projectId, tenantId);

    const stage = await this.prisma.workflowStage.findFirst({
      where: {
        projectId,
        startedAt: { not: null },
        completedAt: null,
      },
      include: stageOwnerInclude,
    });

    return stage ? this.mapStageResponse(stage) : null;
  }

  async transitionToNextStage(projectId: string, tenantId: string): Promise<WorkflowStageResponse> {
    await this.assertProjectInTenant(projectId, tenantId);

    return this.prisma.$transaction(async (tx) => {
      const currentStage = await tx.workflowStage.findFirst({
        where: {
          projectId,
          startedAt: { not: null },
          completedAt: null,
        },
        select: {
          id: true,
          stageName: true,
        },
      });

      if (!currentStage) {
        throw new Error("No active stage to transition from");
      }

      const currentIndex = STAGE_ORDER.indexOf(currentStage.stageName);
      if (currentIndex === -1 || currentIndex === STAGE_ORDER.length - 1) {
        throw new Error("Cannot transition: already at final stage");
      }

      const nextStageName = STAGE_ORDER[currentIndex + 1];
      const now = new Date();

      await tx.workflowStage.update({
        where: { id: currentStage.id },
        data: { completedAt: now },
      });

      const nextStage = await tx.workflowStage.update({
        where: {
          projectId_stageName: {
            projectId,
            stageName: nextStageName,
          },
        },
        data: {
          startedAt: now,
          completedAt: null,
        },
        include: stageOwnerInclude,
      });

      return this.mapStageResponse(nextStage);
    });
  }

  async transitionToStage(input: TransitionToStageInput): Promise<WorkflowStageResponse> {
    const { projectId, tenantId, stageName, ownerUserId } = input;

    await this.assertProjectInTenant(projectId, tenantId);

    if (ownerUserId) {
      const owner = await this.prisma.user.findFirst({
        where: {
          id: ownerUserId,
          tenantId,
        },
        select: { id: true },
      });

      if (!owner) {
        throw new Error("Owner user not found in this tenant");
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const targetStage = await tx.workflowStage.findUnique({
        where: {
          projectId_stageName: {
            projectId,
            stageName,
          },
        },
        select: {
          id: true,
          completedAt: true,
          startedAt: true,
        },
      });

      if (!targetStage) {
        throw new Error("Target stage not found for this project");
      }

      if (targetStage.completedAt) {
        throw new Error("Target stage is already completed");
      }

      const currentStage = await tx.workflowStage.findFirst({
        where: {
          projectId,
          startedAt: { not: null },
          completedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (currentStage && currentStage.id !== targetStage.id) {
        await tx.workflowStage.update({
          where: { id: currentStage.id },
          data: { completedAt: new Date() },
        });
      }

      const now = new Date();
      const activated = await tx.workflowStage.update({
        where: {
          projectId_stageName: {
            projectId,
            stageName,
          },
        },
        data: {
          startedAt: now,
          completedAt: null,
          ownerUserId: ownerUserId ?? null,
        },
        include: stageOwnerInclude,
      });

      return this.mapStageResponse(activated);
    });
  }

  async completeProject(input: CompleteProjectInput): Promise<void> {
    const { projectId, tenantId } = input;
    await this.assertProjectInTenant(projectId, tenantId);

    await this.prisma.workflowStage.updateMany({
      where: {
        projectId,
        completedAt: null,
      },
      data: {
        completedAt: new Date(),
      },
    });
  }

  async completeStage(stageId: string, tenantId: string): Promise<WorkflowStageResponse> {
    const stage = await this.prisma.workflowStage.findFirst({
      where: {
        id: stageId,
        project: {
          tenantId,
        },
      },
      include: stageOwnerInclude,
    });

    if (!stage) {
      throw new Error("Stage not found in this tenant");
    }

    if (stage.completedAt) {
      return this.mapStageResponse(stage);
    }

    const completed = await this.prisma.workflowStage.update({
      where: { id: stageId },
      data: {
        completedAt: new Date(),
      },
      include: stageOwnerInclude,
    });

    return this.mapStageResponse(completed);
  }

  async checkOverdueStages(tenantId: string): Promise<WorkflowStageResponse[]> {
    const activeStages = await this.prisma.workflowStage.findMany({
      where: {
        project: { tenantId },
        startedAt: { not: null },
        completedAt: null,
        slaHours: { gt: 0 },
      },
      include: stageOwnerInclude,
    });

    return activeStages
      .map((stage) => this.mapStageResponse(stage))
      .filter((stage) => stage.isOverdue);
  }

  async getProjectMetrics(projectId: string, tenantId: string): Promise<StageMetrics> {
    await this.assertProjectInTenant(projectId, tenantId);

    const stages = await this.prisma.workflowStage.findMany({
      where: { projectId },
      orderBy: {
        createdAt: "asc",
      },
    });

    const completedStages = stages.filter((stage) => stage.completedAt !== null);
    const activeStage = stages.find((stage) => stage.startedAt !== null && stage.completedAt === null) ?? null;

    const overdueStages = stages.filter((stage) => {
      if (!stage.startedAt || stage.completedAt !== null || stage.slaHours <= 0) {
        return false;
      }

      const elapsedHours = (Date.now() - stage.startedAt.getTime()) / (1000 * 60 * 60);
      return elapsedHours > stage.slaHours;
    }).length;

    const completionHours = stages
      .filter((stage) => stage.startedAt !== null && stage.completedAt !== null)
      .map((stage) => {
        const startedAt = stage.startedAt as Date;
        const completedAt = stage.completedAt as Date;
        return (completedAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
      });

    const averageCompletionHours =
      completionHours.length > 0
        ? completionHours.reduce((sum, value) => sum + value, 0) / completionHours.length
        : 0;

    return {
      totalStages: stages.length,
      completedStages: completedStages.length,
      activeStage: activeStage?.stageName ?? null,
      overdueStages,
      averageCompletionHours,
    };
  }

  private async assertProjectInTenant(projectId: string, tenantId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId,
      },
      select: { id: true },
    });

    if (!project) {
      throw new Error("Project not found in this tenant");
    }
  }

  private mapStageResponse(stage: StageWithOwner): WorkflowStageResponse {
    const isActive = stage.startedAt !== null && stage.completedAt === null;

    let remainingHours: number | null = null;
    let isOverdue = false;

    if (isActive && stage.startedAt) {
      const elapsedMs = Date.now() - stage.startedAt.getTime();
      const elapsedHours = elapsedMs / (1000 * 60 * 60);
      remainingHours = stage.slaHours - elapsedHours;
      isOverdue = stage.slaHours > 0 && remainingHours < 0;
    }

    return {
      id: stage.id,
      projectId: stage.projectId,
      stageName: stage.stageName,
      slaHours: stage.slaHours,
      startedAt: stage.startedAt,
      completedAt: stage.completedAt,
      owner: stage.owner
        ? {
            id: stage.owner.id,
            name: `${stage.owner.firstName} ${stage.owner.lastName}`.trim(),
          }
        : null,
      isActive,
      isOverdue,
      remainingHours: isActive ? remainingHours : null,
      createdAt: stage.createdAt,
      updatedAt: stage.updatedAt,
    };
  }
}

export const workflowService = new WorkflowService();
