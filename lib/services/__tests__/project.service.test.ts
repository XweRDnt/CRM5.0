import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoProvider } from "@prisma/client";
import { ProjectService } from "@/lib/services/project.service";
import { prisma } from "@/lib/utils/db";
import { ProjectStatus } from "@/types";

const deleteVideoMock = vi.fn();

vi.mock("@/lib/services/kinescope.service", () => ({
  getKinescopeService: () => ({
    deleteVideo: deleteVideoMock,
  }),
}));

async function createTestTenant(slug: string) {
  return prisma.tenant.create({
    data: {
      name: `Tenant ${slug}`,
      slug: `${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
  });
}

async function createOwner(tenantId: string, email: string) {
  return prisma.user.create({
    data: {
      tenantId,
      role: "OWNER",
      firstName: "Owner",
      lastName: "User",
      email,
    },
  });
}

describe("ProjectService", () => {
  let projectService: ProjectService;

  beforeEach(async () => {
    deleteVideoMock.mockReset();
    await prisma.assetVersion.deleteMany();
    await prisma.workflowStage.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();
    projectService = new ProjectService();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("createProject", () => {
    it("creates a project with only tenantId and name", async () => {
      const tenant = await createTestTenant("project-minimal");

      const result = await projectService.createProject({
        tenantId: tenant.id,
        name: "Video Project",
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe("Video Project");
      expect(result.status).toBe(ProjectStatus.DRAFT);
      expect(result.revisionsLimit).toBe(3);
      expect(result.revisionsUsed).toBe(0);
    });

    it("auto-creates default workflow stages after project creation", async () => {
      const tenant = await createTestTenant("project-workflow");

      const result = await projectService.createProject({
        tenantId: tenant.id,
        name: "Workflow Project",
      });

      const stages = await prisma.workflowStage.findMany({
        where: { projectId: result.id },
        orderBy: { createdAt: "asc" },
      });

      expect(stages).toHaveLength(7);
      expect(stages[0].stageName).toBe("BRIEFING");
      expect(stages[6].stageName).toBe("COMPLETED");
      expect(stages[0].startedAt).toBeTruthy();
    });

    it("fails when name is empty", async () => {
      const tenant = await createTestTenant("project-empty-name");

      await expect(
        projectService.createProject({
          tenantId: tenant.id,
          name: "",
        }),
      ).rejects.toThrow("Name must be between 1 and 200 characters");
    });
  });

  describe("getProjectById", () => {
    it("returns project data without client fields", async () => {
      const tenant = await createTestTenant("project-get");
      const project = await projectService.createProject({
        tenantId: tenant.id,
        name: "Project",
      });

      const result = await projectService.getProjectById(project.id, tenant.id);

      expect(result.id).toBe(project.id);
      expect(result.name).toBe("Project");
      expect("client" in result).toBe(false);
    });

    it("fails if project exists in different tenant", async () => {
      const tenant1 = await createTestTenant("project-tenant-a");
      const tenant2 = await createTestTenant("project-tenant-b");
      const project = await projectService.createProject({
        tenantId: tenant1.id,
        name: "Project",
      });

      await expect(projectService.getProjectById(project.id, tenant2.id)).rejects.toThrow("Project not found");
    });
  });

  describe("listProjects", () => {
    it("returns all projects for tenant ordered by newest first", async () => {
      const tenant = await createTestTenant("project-list");

      await projectService.createProject({
        tenantId: tenant.id,
        name: "Project 1",
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await projectService.createProject({
        tenantId: tenant.id,
        name: "Project 2",
      });

      const result = await projectService.listProjects(tenant.id);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Project 2");
      expect(result[1].name).toBe("Project 1");
    });

    it("filters by status only", async () => {
      const tenant = await createTestTenant("project-status");
      await projectService.createProject({
        tenantId: tenant.id,
        name: "Draft Project",
      });

      const result = await projectService.listProjects(tenant.id, { status: ProjectStatus.DRAFT });

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every((project) => project.status === ProjectStatus.DRAFT)).toBe(true);
    });
  });

  describe("deleteProject", () => {
    it("deletes kinescope videos before removing project", async () => {
      const tenant = await createTestTenant("project-delete-1");
      const user = await createOwner(tenant.id, "owner-delete@test.com");
      const project = await projectService.createProject({
        tenantId: tenant.id,
        name: "Project",
      });

      await prisma.assetVersion.createMany({
        data: [
          {
            projectId: project.id,
            versionNo: 1,
            fileUrl: "https://kinescope.io/video_a",
            fileKey: "kinescope/video_a",
            fileName: "v1.mp4",
            fileSize: 1000,
            uploadedByUserId: user.id,
            uploadedByLegacy: user.id,
            videoProvider: VideoProvider.KINESCOPE,
            kinescopeVideoId: "video_a",
          },
          {
            projectId: project.id,
            versionNo: 2,
            fileUrl: "https://kinescope.io/video_b",
            fileKey: "kinescope/video_b",
            fileName: "v2.mp4",
            fileSize: 1000,
            uploadedByUserId: user.id,
            uploadedByLegacy: user.id,
            videoProvider: VideoProvider.KINESCOPE,
            kinescopeVideoId: "video_b",
          },
        ],
      });

      deleteVideoMock.mockResolvedValue(undefined);

      await projectService.deleteProject({ tenantId: tenant.id }, { projectId: project.id });

      expect(deleteVideoMock).toHaveBeenCalledTimes(2);
      expect(deleteVideoMock).toHaveBeenCalledWith("video_a");
      expect(deleteVideoMock).toHaveBeenCalledWith("video_b");
      const remaining = await prisma.project.findUnique({ where: { id: project.id } });
      expect(remaining).toBeNull();
    });
  });
});
