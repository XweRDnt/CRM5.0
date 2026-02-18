import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ClientService } from "@/lib/services/client.service";
import { ProjectService } from "@/lib/services/project.service";
import { prisma } from "@/lib/utils/db";
import { ProjectStatus } from "@/types";

describe("ProjectService.createProject", () => {
  let clientService: ClientService;
  let projectService: ProjectService;

  async function createTestTenant(slug: string) {
    return prisma.tenant.create({
      data: {
        name: `Tenant ${slug}`,
        slug: `${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });
  }

  beforeEach(async () => {
    await prisma.project.deleteMany();
    await prisma.clientAccount.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();
    clientService = new ClientService();
    projectService = new ProjectService();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should create project successfully", async () => {
    const tenant = await createTestTenant("agency-8");
    const client = await clientService.createClient({
      tenantId: tenant.id,
      name: "Client",
      email: "client@test.com",
    });

    const result = await projectService.createProject({
      tenantId: tenant.id,
      name: "Video Project",
      description: "Corporate video",
      clientId: client.id,
      brief: "Create 2min promo video",
      revisionsLimit: 5,
    });

    expect(result.id).toBeDefined();
    expect(result.name).toBe("Video Project");
    expect(result.status).toBe(ProjectStatus.DRAFT);
    expect(result.revisionsUsed).toBe(0);
    expect(result.client.id).toBe(client.id);
    expect(result.revisionsLimit).toBe(5);
  });

  it("should auto-create default workflow stages after project creation", async () => {
    const tenant = await createTestTenant("agency-workflow-auto");
    const client = await clientService.createClient({
      tenantId: tenant.id,
      name: "Client",
      email: "client-workflow-auto@test.com",
    });

    const result = await projectService.createProject({
      tenantId: tenant.id,
      name: "Workflow Project",
      clientId: client.id,
    });

    const stages = await prisma.workflowStage.findMany({
      where: {
        projectId: result.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    expect(stages).toHaveLength(7);
    expect(stages[0].stageName).toBe("BRIEFING");
    expect(stages[6].stageName).toBe("COMPLETED");
    expect(stages[0].startedAt).toBeTruthy();
  });

  it("should use default revisionsLimit if not provided", async () => {
    const tenant = await createTestTenant("agency-9");
    const client = await clientService.createClient({
      tenantId: tenant.id,
      name: "Client",
      email: "client@test.com",
    });

    const result = await projectService.createProject({
      tenantId: tenant.id,
      name: "Project",
      clientId: client.id,
    });

    expect(result.revisionsLimit).toBe(3);
  });

  it("should fail if client does not exist", async () => {
    const tenant = await createTestTenant("agency-10");
    await expect(
      projectService.createProject({
        tenantId: tenant.id,
        name: "Project",
        clientId: "nonexistent-client-id",
      }),
    ).rejects.toThrow("Client not found in this tenant");
  });

  it("should fail if client belongs to different tenant", async () => {
    const tenant1 = await createTestTenant("agency-p");
    const tenant2 = await createTestTenant("agency-q");
    const client = await clientService.createClient({
      tenantId: tenant1.id,
      name: "Client",
      email: "client@test.com",
    });

    await expect(
      projectService.createProject({
        tenantId: tenant2.id,
        name: "Project",
        clientId: client.id,
      }),
    ).rejects.toThrow("Client not found in this tenant");
  });

  it("should fail when name is empty", async () => {
    const tenant = await createTestTenant("agency-name-empty");
    const client = await clientService.createClient({
      tenantId: tenant.id,
      name: "Client",
      email: "name-empty@test.com",
    });

    await expect(
      projectService.createProject({
        tenantId: tenant.id,
        name: "",
        clientId: client.id,
      }),
    ).rejects.toThrow("Name must be between 1 and 200 characters");
  });

  it("should fail when revisionsLimit is less than 1", async () => {
    const tenant = await createTestTenant("agency-rev-invalid");
    const client = await clientService.createClient({
      tenantId: tenant.id,
      name: "Client",
      email: "rev-invalid@test.com",
    });

    await expect(
      projectService.createProject({
        tenantId: tenant.id,
        name: "Project",
        clientId: client.id,
        revisionsLimit: 0,
      }),
    ).rejects.toThrow("revisionsLimit must be greater than or equal to 1");
  });
});

describe("ProjectService.getProjectById", () => {
  let clientService: ClientService;
  let projectService: ProjectService;

  async function createTestTenant(slug: string) {
    return prisma.tenant.create({
      data: {
        name: `Tenant ${slug}`,
        slug: `${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });
  }

  beforeEach(async () => {
    await prisma.project.deleteMany();
    await prisma.clientAccount.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();
    clientService = new ClientService();
    projectService = new ProjectService();
  });

  it("should return project with client data", async () => {
    const tenant = await createTestTenant("agency-11");
    const client = await clientService.createClient({
      tenantId: tenant.id,
      name: "Client",
      email: "client@test.com",
    });
    const project = await projectService.createProject({
      tenantId: tenant.id,
      name: "Project",
      clientId: client.id,
    });

    const result = await projectService.getProjectById(project.id, tenant.id);
    expect(result.id).toBe(project.id);
    expect(result.client.name).toBe("Client");
  });

  it("should fail if project does not exist", async () => {
    const tenant = await createTestTenant("agency-12");
    await expect(projectService.getProjectById("nonexistent-id", tenant.id)).rejects.toThrow("Project not found");
  });

  it("should fail if project exists in different tenant", async () => {
    const tenant1 = await createTestTenant("agency-r");
    const tenant2 = await createTestTenant("agency-s");
    const client = await clientService.createClient({
      tenantId: tenant1.id,
      name: "Client",
      email: "client@test.com",
    });
    const project = await projectService.createProject({
      tenantId: tenant1.id,
      name: "Project",
      clientId: client.id,
    });

    await expect(projectService.getProjectById(project.id, tenant2.id)).rejects.toThrow("Project not found");
  });

  it("should fail if tenantId is empty", async () => {
    const tenant = await createTestTenant("agency-empty");
    const client = await clientService.createClient({
      tenantId: tenant.id,
      name: "Client",
      email: "empty@getproject.com",
    });
    const project = await projectService.createProject({
      tenantId: tenant.id,
      name: "Project",
      clientId: client.id,
    });

    await expect(projectService.getProjectById(project.id, "")).rejects.toThrow("tenantId is required");
  });
});

describe("ProjectService.listProjects", () => {
  let clientService: ClientService;
  let projectService: ProjectService;

  async function createTestTenant(slug: string) {
    return prisma.tenant.create({
      data: {
        name: `Tenant ${slug}`,
        slug: `${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });
  }

  beforeEach(async () => {
    await prisma.project.deleteMany();
    await prisma.clientAccount.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();
    clientService = new ClientService();
    projectService = new ProjectService();
  });

  it("should return all projects for tenant", async () => {
    const tenant = await createTestTenant("agency-13");
    const client = await clientService.createClient({
      tenantId: tenant.id,
      name: "Client",
      email: "client@test.com",
    });

    await projectService.createProject({
      tenantId: tenant.id,
      name: "Project 1",
      clientId: client.id,
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await projectService.createProject({
      tenantId: tenant.id,
      name: "Project 2",
      clientId: client.id,
    });

    const result = await projectService.listProjects(tenant.id);
    expect(result.length).toBe(2);
    expect(result[0].name).toBe("Project 2");
  });

  it("should filter by clientId", async () => {
    const tenant = await createTestTenant("agency-14");
    const client1 = await clientService.createClient({
      tenantId: tenant.id,
      name: "Client 1",
      email: "client1@test.com",
    });
    const client2 = await clientService.createClient({
      tenantId: tenant.id,
      name: "Client 2",
      email: "client2@test.com",
    });

    await projectService.createProject({
      tenantId: tenant.id,
      name: "Project C1",
      clientId: client1.id,
    });
    await projectService.createProject({
      tenantId: tenant.id,
      name: "Project C2",
      clientId: client2.id,
    });

    const result = await projectService.listProjects(tenant.id, { clientId: client1.id });
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Project C1");
  });

  it("should filter by status", async () => {
    const tenant = await createTestTenant("agency-15");
    const client = await clientService.createClient({
      tenantId: tenant.id,
      name: "Client",
      email: "client@test.com",
    });

    await projectService.createProject({
      tenantId: tenant.id,
      name: "Draft Project",
      clientId: client.id,
    });

    const result = await projectService.listProjects(tenant.id, {
      status: ProjectStatus.DRAFT,
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.every((project) => project.status === ProjectStatus.DRAFT)).toBe(true);
  });

  it("should not return projects from other tenants", async () => {
    const tenant1 = await createTestTenant("agency-t");
    const tenant2 = await createTestTenant("agency-u");
    const client1 = await clientService.createClient({
      tenantId: tenant1.id,
      name: "Client 1",
      email: "client1@test.com",
    });
    const client2 = await clientService.createClient({
      tenantId: tenant2.id,
      name: "Client 2",
      email: "client2@test.com",
    });

    await projectService.createProject({
      tenantId: tenant1.id,
      name: "Project T1",
      clientId: client1.id,
    });
    await projectService.createProject({
      tenantId: tenant2.id,
      name: "Project T2",
      clientId: client2.id,
    });

    const result = await projectService.listProjects(tenant1.id);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Project T1");
  });

  it("should return empty list when tenant has no projects", async () => {
    const tenant = await createTestTenant("agency-empty-projects");
    const result = await projectService.listProjects(tenant.id);
    expect(result).toEqual([]);
  });

  it("should fail when tenantId is empty", async () => {
    await expect(projectService.listProjects("")).rejects.toThrow("tenantId is required");
  });
});
