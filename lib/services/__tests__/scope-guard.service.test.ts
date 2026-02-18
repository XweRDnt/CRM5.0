import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/utils/db";
import { ScopeGuardService } from "@/lib/services/scope-guard.service";
import { createTestAssetVersion } from "@/tests/factories/asset.factory";
import { createTestClient } from "@/tests/factories/client.factory";
import { createTestFeedback } from "@/tests/factories/feedback.factory";
import { createTestProject } from "@/tests/factories/project.factory";
import { createTestTenant } from "@/tests/factories/tenant.factory";
import { createTestUser } from "@/tests/factories/user.factory";

const scopeGuardService = new ScopeGuardService(prisma);

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
}

async function clearDb() {
  await prisma.scopeDecision.deleteMany();
  await prisma.feedbackItem.deleteMany();
  await prisma.assetVersion.deleteMany();
  await prisma.workflowStage.deleteMany();
  await prisma.aITask.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.clientAccount.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

async function seedProjectWithFeedback() {
  const tenant = await createTestTenant("agency-scope");
  const user = await createTestUser(tenant.id, uniqueEmail("user"), "Test", "PM");
  const client = await createTestClient(tenant.id, uniqueEmail("client"));
  const project = await createTestProject(tenant.id, client.id, "Scope Project");
  const version = await createTestAssetVersion(project.id, user.id);
  const feedback = await createTestFeedback(version.id, "Change logo size");

  return { tenant, user, client, project, version, feedback };
}

describe("ScopeGuardService.createScopeDecision", () => {
  beforeEach(async () => {
    await clearDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should create scope decision", async () => {
    const { tenant, project, feedback } = await seedProjectWithFeedback();

    const result = await scopeGuardService.createScopeDecision({
      projectId: project.id,
      feedbackItemId: feedback.id,
      tenantId: tenant.id,
      aiLabel: "OUT_OF_SCOPE",
      aiConfidence: 0.85,
      aiReasoning: "New deliverable not in scope",
    });

    expect(result.id).toBeDefined();
    expect(result.aiLabel).toBe("OUT_OF_SCOPE");
    expect(result.aiConfidence).toBe(0.85);
    expect(result.pmDecision).toBeNull();
  });

  it("should persist aiReasoning as null when omitted", async () => {
    const { tenant, project, feedback } = await seedProjectWithFeedback();

    const result = await scopeGuardService.createScopeDecision({
      projectId: project.id,
      feedbackItemId: feedback.id,
      tenantId: tenant.id,
      aiLabel: "IN_SCOPE",
      aiConfidence: 0.95,
    });

    expect(result.aiReasoning).toBeNull();
  });

  it("should fail if feedback not found", async () => {
    const { tenant, project } = await seedProjectWithFeedback();

    await expect(
      scopeGuardService.createScopeDecision({
        projectId: project.id,
        feedbackItemId: "missing-feedback-id",
        tenantId: tenant.id,
        aiLabel: "IN_SCOPE",
        aiConfidence: 0.9,
      }),
    ).rejects.toThrow("Feedback not found in this tenant");
  });

  it("should fail if feedback belongs to different tenant", async () => {
    const a = await seedProjectWithFeedback();
    const tenantB = await createTestTenant("agency-scope-b");

    await expect(
      scopeGuardService.createScopeDecision({
        projectId: a.project.id,
        feedbackItemId: a.feedback.id,
        tenantId: tenantB.id,
        aiLabel: "IN_SCOPE",
        aiConfidence: 0.9,
      }),
    ).rejects.toThrow("Feedback not found in this tenant");
  });

  it("should fail if feedback belongs to different project", async () => {
    const a = await seedProjectWithFeedback();
    const client2 = await createTestClient(a.tenant.id, uniqueEmail("client-alt"));
    const project2 = await createTestProject(a.tenant.id, client2.id, "Other Project");

    await expect(
      scopeGuardService.createScopeDecision({
        projectId: project2.id,
        feedbackItemId: a.feedback.id,
        tenantId: a.tenant.id,
        aiLabel: "IN_SCOPE",
        aiConfidence: 0.9,
      }),
    ).rejects.toThrow("Feedback does not belong to this project");
  });

  it("should fail if decision already exists", async () => {
    const { tenant, project, feedback } = await seedProjectWithFeedback();

    const input = {
      projectId: project.id,
      feedbackItemId: feedback.id,
      tenantId: tenant.id,
      aiLabel: "IN_SCOPE" as const,
      aiConfidence: 0.9,
    };

    await scopeGuardService.createScopeDecision(input);

    await expect(scopeGuardService.createScopeDecision(input)).rejects.toThrow("already exists");
  });

  it("should store UNCLEAR label", async () => {
    const { tenant, project, feedback } = await seedProjectWithFeedback();

    const result = await scopeGuardService.createScopeDecision({
      projectId: project.id,
      feedbackItemId: feedback.id,
      tenantId: tenant.id,
      aiLabel: "UNCLEAR",
      aiConfidence: 0.55,
      aiReasoning: "Needs more details",
    });

    expect(result.aiLabel).toBe("UNCLEAR");
  });
});

describe("ScopeGuardService.getScopeDecisionById", () => {
  beforeEach(async () => {
    await clearDb();
  });

  it("should get scope decision by id", async () => {
    const { tenant, project, feedback } = await seedProjectWithFeedback();
    const created = await scopeGuardService.createScopeDecision({
      projectId: project.id,
      feedbackItemId: feedback.id,
      tenantId: tenant.id,
      aiLabel: "IN_SCOPE",
      aiConfidence: 0.93,
      aiReasoning: "Logo size tweak is refinement",
    });

    const result = await scopeGuardService.getScopeDecisionById(created.id, tenant.id);
    expect(result.id).toBe(created.id);
    expect(result.aiLabel).toBe("IN_SCOPE");
  });

  it("should fail when scope decision does not exist", async () => {
    const tenant = await createTestTenant("agency-scope-get");
    await expect(scopeGuardService.getScopeDecisionById("missing-id", tenant.id)).rejects.toThrow(
      "Scope decision not found in this tenant",
    );
  });

  it("should fail when scope decision exists in another tenant", async () => {
    const a = await seedProjectWithFeedback();
    const b = await createTestTenant("agency-scope-get-b");
    const created = await scopeGuardService.createScopeDecision({
      projectId: a.project.id,
      feedbackItemId: a.feedback.id,
      tenantId: a.tenant.id,
      aiLabel: "IN_SCOPE",
      aiConfidence: 0.93,
    });

    await expect(scopeGuardService.getScopeDecisionById(created.id, b.id)).rejects.toThrow(
      "Scope decision not found in this tenant",
    );
  });
});

describe("ScopeGuardService.listScopeDecisionsByProject", () => {
  beforeEach(async () => {
    await clearDb();
  });

  it("should list all scope decisions for a project", async () => {
    const base = await seedProjectWithFeedback();
    const feedback2 = await createTestFeedback(base.version.id, "Add intro animation");

    await scopeGuardService.createScopeDecision({
      projectId: base.project.id,
      feedbackItemId: base.feedback.id,
      tenantId: base.tenant.id,
      aiLabel: "IN_SCOPE",
      aiConfidence: 0.88,
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await scopeGuardService.createScopeDecision({
      projectId: base.project.id,
      feedbackItemId: feedback2.id,
      tenantId: base.tenant.id,
      aiLabel: "OUT_OF_SCOPE",
      aiConfidence: 0.8,
    });

    const result = await scopeGuardService.listScopeDecisionsByProject(base.project.id, base.tenant.id);

    expect(result.length).toBe(2);
  });

  it("should sort by newest first", async () => {
    const base = await seedProjectWithFeedback();
    const feedback2 = await createTestFeedback(base.version.id, "Second comment");

    const first = await scopeGuardService.createScopeDecision({
      projectId: base.project.id,
      feedbackItemId: base.feedback.id,
      tenantId: base.tenant.id,
      aiLabel: "IN_SCOPE",
      aiConfidence: 0.88,
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await scopeGuardService.createScopeDecision({
      projectId: base.project.id,
      feedbackItemId: feedback2.id,
      tenantId: base.tenant.id,
      aiLabel: "OUT_OF_SCOPE",
      aiConfidence: 0.8,
    });

    const result = await scopeGuardService.listScopeDecisionsByProject(base.project.id, base.tenant.id);

    expect(result[0].id).toBe(second.id);
    expect(result[1].id).toBe(first.id);
  });

  it("should return empty array for project with no decisions", async () => {
    const tenant = await createTestTenant("agency-scope-list-empty");
    const user = await createTestUser(tenant.id, uniqueEmail("u"));
    const client = await createTestClient(tenant.id, uniqueEmail("c"));
    const project = await createTestProject(tenant.id, client.id, "No Decisions Project");
    await createTestAssetVersion(project.id, user.id);

    const result = await scopeGuardService.listScopeDecisionsByProject(project.id, tenant.id);
    expect(result).toEqual([]);
  });

  it("should fail if project is not in tenant", async () => {
    const base = await seedProjectWithFeedback();
    const tenantB = await createTestTenant("agency-scope-list-b");

    await expect(scopeGuardService.listScopeDecisionsByProject(base.project.id, tenantB.id)).rejects.toThrow(
      "Project not found in this tenant",
    );
  });

  it("should not include decisions from other projects", async () => {
    const base = await seedProjectWithFeedback();
    const feedback2 = await createTestFeedback(base.version.id, "Add intro animation");

    await scopeGuardService.createScopeDecision({
      projectId: base.project.id,
      feedbackItemId: base.feedback.id,
      tenantId: base.tenant.id,
      aiLabel: "IN_SCOPE",
      aiConfidence: 0.88,
    });

    const client2 = await createTestClient(base.tenant.id, uniqueEmail("client-two"));
    const project2 = await createTestProject(base.tenant.id, client2.id, "Second Project");
    const version2 = await createTestAssetVersion(project2.id, base.user.id);
    const otherFeedback = await createTestFeedback(version2.id, "Other project feedback");

    await scopeGuardService.createScopeDecision({
      projectId: project2.id,
      feedbackItemId: otherFeedback.id,
      tenantId: base.tenant.id,
      aiLabel: "OUT_OF_SCOPE",
      aiConfidence: 0.77,
    });

    await scopeGuardService.createScopeDecision({
      projectId: base.project.id,
      feedbackItemId: feedback2.id,
      tenantId: base.tenant.id,
      aiLabel: "OUT_OF_SCOPE",
      aiConfidence: 0.81,
    });

    const result = await scopeGuardService.listScopeDecisionsByProject(base.project.id, base.tenant.id);
    expect(result.length).toBe(2);
    expect(result.every((item) => item.projectId === base.project.id)).toBe(true);
  });
});

describe("ScopeGuardService.makePMDecision", () => {
  beforeEach(async () => {
    await clearDb();
  });

  it("should make PM decision", async () => {
    const base = await seedProjectWithFeedback();
    const decision = await scopeGuardService.createScopeDecision({
      projectId: base.project.id,
      feedbackItemId: base.feedback.id,
      tenantId: base.tenant.id,
      aiLabel: "OUT_OF_SCOPE",
      aiConfidence: 0.8,
    });

    const result = await scopeGuardService.makePMDecision({
      scopeDecisionId: decision.id,
      tenantId: base.tenant.id,
      pmUserId: base.user.id,
      decision: "APPROVED",
      reason: "Confirmed out of scope",
      changeRequestAmount: 500,
    });

    expect(result.pmDecision).toBe("APPROVED");
    expect(result.pmReason).toBe("Confirmed out of scope");
    expect(result.changeRequestAmount).toBe(500);
    expect(result.decidedBy?.id).toBe(base.user.id);
    expect(result.decidedAt).toBeTruthy();
  });

  it("should allow NEEDS_INFO PM decision", async () => {
    const base = await seedProjectWithFeedback();
    const decision = await scopeGuardService.createScopeDecision({
      projectId: base.project.id,
      feedbackItemId: base.feedback.id,
      tenantId: base.tenant.id,
      aiLabel: "UNCLEAR",
      aiConfidence: 0.6,
    });

    const result = await scopeGuardService.makePMDecision({
      scopeDecisionId: decision.id,
      tenantId: base.tenant.id,
      pmUserId: base.user.id,
      decision: "NEEDS_INFO",
      reason: "Need clarification from client",
    });

    expect(result.pmDecision).toBe("NEEDS_INFO");
    expect(result.changeRequestAmount).toBeNull();
  });

  it("should set nullable PM fields to null when omitted", async () => {
    const base = await seedProjectWithFeedback();
    const decision = await scopeGuardService.createScopeDecision({
      projectId: base.project.id,
      feedbackItemId: base.feedback.id,
      tenantId: base.tenant.id,
      aiLabel: "OUT_OF_SCOPE",
      aiConfidence: 0.7,
    });

    const result = await scopeGuardService.makePMDecision({
      scopeDecisionId: decision.id,
      tenantId: base.tenant.id,
      pmUserId: base.user.id,
      decision: "REJECTED",
    });

    expect(result.pmReason).toBeNull();
    expect(result.changeRequestAmount).toBeNull();
  });

  it("should overwrite previous PM decision", async () => {
    const base = await seedProjectWithFeedback();
    const decision = await scopeGuardService.createScopeDecision({
      projectId: base.project.id,
      feedbackItemId: base.feedback.id,
      tenantId: base.tenant.id,
      aiLabel: "OUT_OF_SCOPE",
      aiConfidence: 0.8,
    });

    await scopeGuardService.makePMDecision({
      scopeDecisionId: decision.id,
      tenantId: base.tenant.id,
      pmUserId: base.user.id,
      decision: "NEEDS_INFO",
      reason: "First pass",
    });

    const result = await scopeGuardService.makePMDecision({
      scopeDecisionId: decision.id,
      tenantId: base.tenant.id,
      pmUserId: base.user.id,
      decision: "APPROVED",
      reason: "Approved after clarification",
      changeRequestAmount: 750,
    });

    expect(result.pmDecision).toBe("APPROVED");
    expect(result.pmReason).toBe("Approved after clarification");
    expect(result.changeRequestAmount).toBe(750);
  });

  it("should fail if scope decision is missing", async () => {
    const tenant = await createTestTenant("agency-scope-missing");
    const user = await createTestUser(tenant.id, uniqueEmail("pm-missing"));

    await expect(
      scopeGuardService.makePMDecision({
        scopeDecisionId: "missing-id",
        tenantId: tenant.id,
        pmUserId: user.id,
        decision: "APPROVED",
      }),
    ).rejects.toThrow("Scope decision not found in this tenant");
  });

  it("should fail if scope decision belongs to another tenant", async () => {
    const a = await seedProjectWithFeedback();
    const bTenant = await createTestTenant("agency-scope-mp-b");
    const bUser = await createTestUser(bTenant.id, uniqueEmail("pm-b"));

    const decision = await scopeGuardService.createScopeDecision({
      projectId: a.project.id,
      feedbackItemId: a.feedback.id,
      tenantId: a.tenant.id,
      aiLabel: "OUT_OF_SCOPE",
      aiConfidence: 0.82,
    });

    await expect(
      scopeGuardService.makePMDecision({
        scopeDecisionId: decision.id,
        tenantId: bTenant.id,
        pmUserId: bUser.id,
        decision: "APPROVED",
      }),
    ).rejects.toThrow("Scope decision not found in this tenant");
  });

  it("should fail if PM user not found in tenant", async () => {
    const a = await seedProjectWithFeedback();
    const bTenant = await createTestTenant("agency-scope-mp-user");
    const bUser = await createTestUser(bTenant.id, uniqueEmail("pm-user-b"));

    const decision = await scopeGuardService.createScopeDecision({
      projectId: a.project.id,
      feedbackItemId: a.feedback.id,
      tenantId: a.tenant.id,
      aiLabel: "OUT_OF_SCOPE",
      aiConfidence: 0.82,
    });

    await expect(
      scopeGuardService.makePMDecision({
        scopeDecisionId: decision.id,
        tenantId: a.tenant.id,
        pmUserId: bUser.id,
        decision: "APPROVED",
      }),
    ).rejects.toThrow("PM user not found in this tenant");
  });

  it("should expose full PM name in decidedBy", async () => {
    const base = await seedProjectWithFeedback();
    const decision = await scopeGuardService.createScopeDecision({
      projectId: base.project.id,
      feedbackItemId: base.feedback.id,
      tenantId: base.tenant.id,
      aiLabel: "OUT_OF_SCOPE",
      aiConfidence: 0.82,
    });

    const result = await scopeGuardService.makePMDecision({
      scopeDecisionId: decision.id,
      tenantId: base.tenant.id,
      pmUserId: base.user.id,
      decision: "APPROVED",
    });

    expect(result.decidedBy?.name.length).toBeGreaterThan(0);
    expect(result.decidedBy?.name).toContain("Test");
  });

  it("should keep ai fields unchanged after PM decision", async () => {
    const base = await seedProjectWithFeedback();
    const created = await scopeGuardService.createScopeDecision({
      projectId: base.project.id,
      feedbackItemId: base.feedback.id,
      tenantId: base.tenant.id,
      aiLabel: "OUT_OF_SCOPE",
      aiConfidence: 0.66,
      aiReasoning: "New deliverable",
    });

    const result = await scopeGuardService.makePMDecision({
      scopeDecisionId: created.id,
      tenantId: base.tenant.id,
      pmUserId: base.user.id,
      decision: "REJECTED",
      reason: "Actually covered by contract",
    });

    expect(result.aiLabel).toBe("OUT_OF_SCOPE");
    expect(result.aiConfidence).toBe(0.66);
    expect(result.aiReasoning).toBe("New deliverable");
  });
});
