import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/utils/db";
import type { CreateScopeDecisionInput, MakePMDecisionInput, ScopeDecisionResponse } from "@/types";

type ScopeDecisionWithPmUser = Prisma.ScopeDecisionGetPayload<{
  include: {
    pmUser: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
      };
    };
  };
}>;

export class ScopeGuardService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async createScopeDecision(input: CreateScopeDecisionInput): Promise<ScopeDecisionResponse> {
    const { projectId, feedbackItemId, tenantId, aiLabel, aiConfidence, aiReasoning } = input;

    const feedback = await this.prisma.feedbackItem.findFirst({
      where: { id: feedbackItemId },
      include: {
        assetVersion: {
          include: {
            project: {
              select: { tenantId: true, id: true },
            },
          },
        },
      },
    });

    if (!feedback || feedback.assetVersion.project.tenantId !== tenantId) {
      throw new Error("Feedback not found in this tenant");
    }

    if (feedback.assetVersion.project.id !== projectId) {
      throw new Error("Feedback does not belong to this project");
    }

    const existing = await this.prisma.scopeDecision.findUnique({
      where: { feedbackItemId },
    });

    if (existing) {
      throw new Error("Scope decision already exists for this feedback");
    }

    const decision = await this.prisma.scopeDecision.create({
      data: {
        projectId,
        feedbackItemId,
        aiLabel,
        aiConfidence,
        aiReasoning: aiReasoning ?? null,
      },
      include: {
        pmUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return this.mapScopeDecisionResponse(decision);
  }

  async getScopeDecisionById(id: string, tenantId: string): Promise<ScopeDecisionResponse> {
    const decision = await this.prisma.scopeDecision.findFirst({
      where: { id },
      include: {
        project: {
          select: { tenantId: true },
        },
        pmUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!decision || decision.project.tenantId !== tenantId) {
      throw new Error("Scope decision not found in this tenant");
    }

    return this.mapScopeDecisionResponse(decision);
  }

  async listScopeDecisionsByProject(projectId: string, tenantId: string): Promise<ScopeDecisionResponse[]> {
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

    const decisions = await this.prisma.scopeDecision.findMany({
      where: { projectId },
      include: {
        pmUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return decisions.map((decision) => this.mapScopeDecisionResponse(decision));
  }

  async makePMDecision(input: MakePMDecisionInput): Promise<ScopeDecisionResponse> {
    const { scopeDecisionId, tenantId, pmUserId, decision, reason, changeRequestAmount } = input;

    const scopeDecision = await this.prisma.scopeDecision.findFirst({
      where: { id: scopeDecisionId },
      include: {
        project: {
          select: { tenantId: true },
        },
      },
    });

    if (!scopeDecision || scopeDecision.project.tenantId !== tenantId) {
      throw new Error("Scope decision not found in this tenant");
    }

    const pmUser = await this.prisma.user.findFirst({
      where: {
        id: pmUserId,
        tenantId,
      },
      select: { id: true },
    });

    if (!pmUser) {
      throw new Error("PM user not found in this tenant");
    }

    const updated = await this.prisma.scopeDecision.update({
      where: { id: scopeDecisionId },
      data: {
        pmDecision: decision,
        pmReason: reason ?? null,
        changeRequestAmount: changeRequestAmount ?? null,
        decidedBy: pmUserId,
        decidedAt: new Date(),
      },
      include: {
        pmUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return this.mapScopeDecisionResponse(updated);
  }

  private mapScopeDecisionResponse(decision: ScopeDecisionWithPmUser): ScopeDecisionResponse {
    return {
      id: decision.id,
      projectId: decision.projectId,
      feedbackItemId: decision.feedbackItemId,
      aiLabel: decision.aiLabel,
      aiConfidence: decision.aiConfidence,
      aiReasoning: decision.aiReasoning,
      pmDecision: decision.pmDecision,
      pmReason: decision.pmReason,
      changeRequestAmount: decision.changeRequestAmount ? Number(decision.changeRequestAmount) : null,
      decidedBy: decision.pmUser
        ? {
            id: decision.pmUser.id,
            name: `${decision.pmUser.firstName} ${decision.pmUser.lastName}`.trim(),
          }
        : null,
      decidedAt: decision.decidedAt,
      createdAt: decision.createdAt,
      updatedAt: decision.updatedAt,
    };
  }
}

export const scopeGuardService = new ScopeGuardService();
