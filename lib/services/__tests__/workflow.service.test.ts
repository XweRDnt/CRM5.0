import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient, type WorkflowStageName } from "@prisma/client";
import { WorkflowService } from "@/lib/services/workflow.service";
import { DEFAULT_STAGE_SLA, STAGE_ORDER } from "@/lib/constants/workflow";
import { createTestTenant } from "@/tests/factories/tenant.factory";
import { createTestClient } from "@/tests/factories/client.factory";
import { createTestProject } from "@/tests/factories/project.factory";
import { createTestUser } from "@/tests/factories/user.factory";

const prisma = new PrismaClient();
const workflowService = new WorkflowService(prisma);

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
}

async function clearDb() {
  await prisma.workflowStage.deleteMany();
  await prisma.scopeDecision.deleteMany();
  await prisma.feedbackItem.deleteMany();
  await prisma.assetVersion.deleteMany();
  await prisma.aITask.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.clientAccount.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

async function seedProject(slugPrefix: string) {
  const tenant = await createTestTenant(slugPrefix);
  const client = await createTestClient(tenant.id, uniqueEmail(`client-${slugPrefix}`));
  const project = await createTestProject(tenant.id, client.id, `Project ${slugPrefix}`);
  return { tenant, client, project };
}

describe("WorkflowService.createDefaultStages", () => {
  beforeEach(async () => {
    await clearDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should create 7 default stages in exact order", async () => {
    const { tenant, project } = await seedProject("wf-create-order");

    const stages = await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    expect(stages).toHaveLength(7);
    expect(stages.map((s) => s.stageName)).toEqual(STAGE_ORDER);
  });

  it("should apply default SLA values for all stages", async () => {
    const { tenant, project } = await seedProject("wf-create-sla");

    const stages = await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    for (const stage of stages) {
      expect(stage.slaHours).toBe(DEFAULT_STAGE_SLA[stage.stageName]);
    }
  });

  it("should start BRIEFING immediately and keep others inactive", async () => {
    const { tenant, project } = await seedProject("wf-create-briefing");

    const stages = await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    const briefing = stages.find((stage) => stage.stageName === "BRIEFING");
    const production = stages.find((stage) => stage.stageName === "PRODUCTION");

    expect(briefing?.startedAt).toBeTruthy();
    expect(briefing?.isActive).toBe(true);
    expect(production?.startedAt).toBeNull();
    expect(production?.isActive).toBe(false);
  });

  it("should default owner to null for all stages", async () => {
    const { tenant, project } = await seedProject("wf-create-owner");

    const stages = await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    expect(stages.every((stage) => stage.owner === null)).toBe(true);
  });

  it("should fail if project is not in tenant", async () => {
    const source = await seedProject("wf-create-tenant-a");
    const tenantB = await createTestTenant("wf-create-tenant-b");

    await expect(
      workflowService.createDefaultStages({
        projectId: source.project.id,
        tenantId: tenantB.id,
      }),
    ).rejects.toThrow("Project not found in this tenant");
  });

  it("should fail if workflow stages already exist", async () => {
    const { tenant, project } = await seedProject("wf-create-existing");

    await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    await expect(
      workflowService.createDefaultStages({
        projectId: project.id,
        tenantId: tenant.id,
      }),
    ).rejects.toThrow("already exist");
  });
});

describe("WorkflowService.getCurrentStage", () => {
  beforeEach(async () => {
    await clearDb();
  });

  it("should return active BRIEFING after default creation", async () => {
    const { tenant, project } = await seedProject("wf-current-active");

    await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    const current = await workflowService.getCurrentStage(project.id, tenant.id);

    expect(current?.stageName).toBe("BRIEFING");
    expect(current?.isActive).toBe(true);
  });

  it("should return null when project has no active stages", async () => {
    const { tenant, project } = await seedProject("wf-current-none");

    await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    await prisma.workflowStage.updateMany({
      where: {
        projectId: project.id,
      },
      data: {
        completedAt: new Date(),
      },
    });

    const current = await workflowService.getCurrentStage(project.id, tenant.id);
    expect(current).toBeNull();
  });

  it("should include owner when stage has owner", async () => {
    const { tenant, project } = await seedProject("wf-current-owner");
    const owner = await createTestUser(tenant.id, uniqueEmail("wf-owner"), "Jane", "Manager");

    await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    await prisma.workflowStage.updateMany({
      where: {
        projectId: project.id,
        stageName: "BRIEFING",
      },
      data: {
        ownerUserId: owner.id,
      },
    });

    const current = await workflowService.getCurrentStage(project.id, tenant.id);

    expect(current?.owner).toEqual({
      id: owner.id,
      name: "Jane Manager",
    });
  });

  it("should calculate overdue for active stage", async () => {
    const { tenant, project } = await seedProject("wf-current-overdue");

    await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    await prisma.workflowStage.updateMany({
      where: {
        projectId: project.id,
        stageName: "BRIEFING",
      },
      data: {
        startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      },
    });

    const current = await workflowService.getCurrentStage(project.id, tenant.id);

    expect(current?.isOverdue).toBe(true);
    expect(current?.remainingHours).toBeLessThan(0);
  });

  it("should fail if project does not belong to tenant", async () => {
    const source = await seedProject("wf-current-tenant-a");
    const tenantB = await createTestTenant("wf-current-tenant-b");

    await expect(workflowService.getCurrentStage(source.project.id, tenantB.id)).rejects.toThrow(
      "Project not found in this tenant",
    );
  });
});

describe("WorkflowService.transitionToNextStage", () => {
  beforeEach(async () => {
    await clearDb();
  });

  it("should transition from BRIEFING to PRODUCTION", async () => {
    const { tenant, project } = await seedProject("wf-next-1");

    await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    const next = await workflowService.transitionToNextStage(project.id, tenant.id);

    expect(next.stageName).toBe("PRODUCTION");
    expect(next.isActive).toBe(true);

    const briefing = await prisma.workflowStage.findFirst({
      where: {
        projectId: project.id,
        stageName: "BRIEFING",
      },
    });

    expect(briefing?.completedAt).toBeTruthy();
  });

  it("should fail when no active stage exists", async () => {
    const { tenant, project } = await seedProject("wf-next-no-active");

    await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    await prisma.workflowStage.updateMany({
      where: {
        projectId: project.id,
      },
      data: {
        startedAt: null,
        completedAt: null,
      },
    });

    await expect(workflowService.transitionToNextStage(project.id, tenant.id)).rejects.toThrow(
      "No active stage to transition from",
    );
  });

  it("should fail when already at COMPLETED", async () => {
    const { tenant, project } = await seedProject("wf-next-final");

    await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    await prisma.workflowStage.updateMany({
      where: {
        projectId: project.id,
      },
      data: {
        startedAt: null,
        completedAt: null,
      },
    });

    await prisma.workflowStage.updateMany({
      where: {
        projectId: project.id,
        stageName: "COMPLETED",
      },
      data: {
        startedAt: new Date(),
      },
    });

    await expect(workflowService.transitionToNextStage(project.id, tenant.id)).rejects.toThrow(
      "Cannot transition: already at final stage",
    );
  });

  it("should fail when project is in another tenant", async () => {
    const source = await seedProject("wf-next-tenant-a");
    const tenantB = await createTestTenant("wf-next-tenant-b");

    await expect(workflowService.transitionToNextStage(source.project.id, tenantB.id)).rejects.toThrow(
      "Project not found in this tenant",
    );
  });
});

describe("WorkflowService.transitionToStage", () => {
  beforeEach(async () => {
    await clearDb();
  });

  it("should transition to a specific stage and complete current", async () => {
    const { tenant, project } = await seedProject("wf-target-jump");

    await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    const stage = await workflowService.transitionToStage({
      projectId: project.id,
      tenantId: tenant.id,
      stageName: "APPROVAL",
    });

    expect(stage.stageName).toBe("APPROVAL");
    expect(stage.isActive).toBe(true);

    const briefing = await prisma.workflowStage.findUnique({
      where: {
        projectId_stageName: {
          projectId: project.id,
          stageName: "BRIEFING",
        },
      },
    });

    expect(briefing?.completedAt).toBeTruthy();
  });

  it("should set owner when ownerUserId is provided", async () => {
    const { tenant, project } = await seedProject("wf-target-owner");
    const owner = await createTestUser(tenant.id, uniqueEmail("wf-target-owner"), "Owner", "PM");

    await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    const stage = await workflowService.transitionToStage({
      projectId: project.id,
      tenantId: tenant.id,
      stageName: "PRODUCTION",
      ownerUserId: owner.id,
    });

    expect(stage.owner?.id).toBe(owner.id);
    expect(stage.owner?.name).toBe("Owner PM");
  });

  it("should fail when target stage is already completed", async () => {
    const { tenant, project } = await seedProject("wf-target-completed");

    await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    await prisma.workflowStage.update({
      where: {
        projectId_stageName: {
          projectId: project.id,
          stageName: "APPROVAL",
        },
      },
      data: {
        startedAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
        completedAt: new Date(),
      },
    });

    await expect(
      workflowService.transitionToStage({
        projectId: project.id,
        tenantId: tenant.id,
        stageName: "APPROVAL",
      }),
    ).rejects.toThrow("already completed");
  });

  it("should fail when owner user is outside tenant", async () => {
    const { tenant, project } = await seedProject("wf-target-owner-tenant-a");
    const tenantB = await createTestTenant("wf-target-owner-tenant-b");
    const ownerFromB = await createTestUser(tenantB.id, uniqueEmail("wf-owner-b"));

    await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    await expect(
      workflowService.transitionToStage({
        projectId: project.id,
        tenantId: tenant.id,
        stageName: "PRODUCTION",
        ownerUserId: ownerFromB.id,
      }),
    ).rejects.toThrow("Owner user not found in this tenant");
  });

  it("should fail if project does not belong to tenant", async () => {
    const source = await seedProject("wf-target-tenant-a");
    const tenantB = await createTestTenant("wf-target-tenant-b");

    await expect(
      workflowService.transitionToStage({
        projectId: source.project.id,
        tenantId: tenantB.id,
        stageName: "PRODUCTION",
      }),
    ).rejects.toThrow("Project not found in this tenant");
  });
});

describe("WorkflowService.completeStage", () => {
  beforeEach(async () => {
    await clearDb();
  });

  it("should mark stage complete by id", async () => {
    const { tenant, project } = await seedProject("wf-complete-1");

    await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    const stage = await prisma.workflowStage.findUniqueOrThrow({
      where: {
        projectId_stageName: {
          projectId: project.id,
          stageName: "BRIEFING",
        },
      },
    });

    const completed = await workflowService.completeStage(stage.id, tenant.id);

    expect(completed.completedAt).toBeTruthy();
    expect(completed.stageName).toBe("BRIEFING");
  });

  it("should fail when stage does not exist in tenant", async () => {
    const tenant = await createTestTenant("wf-complete-missing");
    await expect(workflowService.completeStage("missing-stage", tenant.id)).rejects.toThrow(
      "Stage not found in this tenant",
    );
  });

  it("should fail when stage belongs to another tenant", async () => {
    const source = await seedProject("wf-complete-tenant-a");
    const tenantB = await createTestTenant("wf-complete-tenant-b");

    await workflowService.createDefaultStages({
      projectId: source.project.id,
      tenantId: source.tenant.id,
    });

    const stage = await prisma.workflowStage.findUniqueOrThrow({
      where: {
        projectId_stageName: {
          projectId: source.project.id,
          stageName: "BRIEFING",
        },
      },
    });

    await expect(workflowService.completeStage(stage.id, tenantB.id)).rejects.toThrow("Stage not found in this tenant");
  });
});

describe("WorkflowService.checkOverdueStages", () => {
  beforeEach(async () => {
    await clearDb();
  });

  it("should return overdue active stages for tenant", async () => {
    const { tenant, project } = await seedProject("wf-overdue-1");

    await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    await prisma.workflowStage.update({
      where: {
        projectId_stageName: {
          projectId: project.id,
          stageName: "BRIEFING",
        },
      },
      data: {
        startedAt: new Date(Date.now() - 49 * 60 * 60 * 1000),
      },
    });

    const overdue = await workflowService.checkOverdueStages(tenant.id);

    expect(overdue).toHaveLength(1);
    expect(overdue[0].stageName).toBe("BRIEFING");
    expect(overdue[0].isOverdue).toBe(true);
  });

  it("should not include non-overdue active stages", async () => {
    const { tenant, project } = await seedProject("wf-overdue-2");

    await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    const overdue = await workflowService.checkOverdueStages(tenant.id);
    expect(overdue).toHaveLength(0);
  });

  it("should not include completed stages", async () => {
    const { tenant, project } = await seedProject("wf-overdue-3");

    await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    await prisma.workflowStage.update({
      where: {
        projectId_stageName: {
          projectId: project.id,
          stageName: "BRIEFING",
        },
      },
      data: {
        startedAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
        completedAt: new Date(),
      },
    });

    const overdue = await workflowService.checkOverdueStages(tenant.id);
    expect(overdue).toHaveLength(0);
  });

  it("should isolate overdue checks by tenant", async () => {
    const a = await seedProject("wf-overdue-tenant-a");
    const b = await seedProject("wf-overdue-tenant-b");

    await workflowService.createDefaultStages({
      projectId: a.project.id,
      tenantId: a.tenant.id,
    });
    await workflowService.createDefaultStages({
      projectId: b.project.id,
      tenantId: b.tenant.id,
    });

    await prisma.workflowStage.updateMany({
      where: {
        projectId: a.project.id,
        stageName: "BRIEFING",
      },
      data: {
        startedAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
      },
    });

    await prisma.workflowStage.updateMany({
      where: {
        projectId: b.project.id,
        stageName: "BRIEFING",
      },
      data: {
        startedAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
      },
    });

    const overdueA = await workflowService.checkOverdueStages(a.tenant.id);
    expect(overdueA).toHaveLength(1);
    expect(overdueA[0].projectId).toBe(a.project.id);
  });
});

describe("WorkflowService.getProjectMetrics", () => {
  beforeEach(async () => {
    await clearDb();
  });

  async function prepareProjectWithTransition(
    stageName: WorkflowStageName,
    tenantId: string,
    projectId: string,
    startedAt: Date,
    completedAt: Date,
  ) {
    await prisma.workflowStage.update({
      where: {
        projectId_stageName: {
          projectId,
          stageName,
        },
      },
      data: {
        startedAt,
        completedAt,
      },
    });
  }

  it("should return core metrics for project", async () => {
    const { tenant, project } = await seedProject("wf-metrics-1");

    await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    const now = Date.now();

    await prepareProjectWithTransition(
      "BRIEFING",
      tenant.id,
      project.id,
      new Date(now - 60 * 60 * 1000),
      new Date(now - 30 * 60 * 1000),
    );

    await prepareProjectWithTransition(
      "PRODUCTION",
      tenant.id,
      project.id,
      new Date(now - 12 * 60 * 60 * 1000),
      new Date(now - 2 * 60 * 60 * 1000),
    );

    await prisma.workflowStage.update({
      where: {
        projectId_stageName: {
          projectId: project.id,
          stageName: "CLIENT_REVIEW",
        },
      },
      data: {
        startedAt: new Date(now - 3 * 60 * 60 * 1000),
        completedAt: null,
      },
    });

    const metrics = await workflowService.getProjectMetrics(project.id, tenant.id);

    expect(metrics.totalStages).toBe(7);
    expect(metrics.completedStages).toBe(2);
    expect(metrics.activeStage).toBe("CLIENT_REVIEW");
    expect(metrics.overdueStages).toBe(0);
    expect(metrics.averageCompletionHours).toBeGreaterThan(0);
  });

  it("should return zero average when no stages are completed", async () => {
    const { tenant, project } = await seedProject("wf-metrics-2");

    await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    const metrics = await workflowService.getProjectMetrics(project.id, tenant.id);

    expect(metrics.completedStages).toBe(0);
    expect(metrics.averageCompletionHours).toBe(0);
  });

  it("should count overdue active stage in metrics", async () => {
    const { tenant, project } = await seedProject("wf-metrics-3");

    await workflowService.createDefaultStages({
      projectId: project.id,
      tenantId: tenant.id,
    });

    await prisma.workflowStage.updateMany({
      where: {
        projectId: project.id,
        stageName: "BRIEFING",
      },
      data: {
        startedAt: new Date(Date.now() - 50 * 60 * 60 * 1000),
      },
    });

    const metrics = await workflowService.getProjectMetrics(project.id, tenant.id);

    expect(metrics.overdueStages).toBe(1);
    expect(metrics.activeStage).toBe("BRIEFING");
  });

  it("should fail when project does not belong to tenant", async () => {
    const source = await seedProject("wf-metrics-tenant-a");
    const tenantB = await createTestTenant("wf-metrics-tenant-b");

    await expect(workflowService.getProjectMetrics(source.project.id, tenantB.id)).rejects.toThrow(
      "Project not found in this tenant",
    );
  });
});
