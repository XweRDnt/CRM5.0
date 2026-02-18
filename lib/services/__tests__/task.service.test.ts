import { UserRole as PrismaUserRole, type PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TaskService } from "@/lib/services/task.service";
import { prisma } from "@/lib/utils/db";
import { createTestClient } from "@/tests/factories/client.factory";
import { createTestProject } from "@/tests/factories/project.factory";
import { createTestTenant } from "@/tests/factories/tenant.factory";
import { createTestUser } from "@/tests/factories/user.factory";

const taskService = new TaskService(prisma as PrismaClient);

async function cleanup() {
  await prisma.projectMember.deleteMany();
  await prisma.aITask.deleteMany();
  await prisma.scopeDecision.deleteMany();
  await prisma.feedbackItem.deleteMany();
  await prisma.assetVersion.deleteMany();
  await prisma.project.deleteMany();
  await prisma.clientAccount.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

async function createEditor(tenantId: string, email: string, firstName: string) {
  return prisma.user.create({
    data: {
      tenantId,
      role: PrismaUserRole.EDITOR,
      firstName,
      lastName: "Editor",
      email,
    },
  });
}

describe("TaskService.createTask", () => {
  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("should create task with all fields", async () => {
    const tenant = await createTestTenant("agency-task-1");
    const user = await createEditor(tenant.id, "editor-task-1@test.com", "Alice");
    const client = await createTestClient(tenant.id, "client-task-1@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");

    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await taskService.createTask({
      projectId: project.id,
      tenantId: tenant.id,
      title: "Change logo color",
      description: "Change to blue",
      priority: "HIGH",
      category: "DESIGN",
      assignedToUserId: user.id,
      estimatedMinutes: 30,
      dueDate,
      sourceFeedbackIds: ["fb-1", "fb-2"],
    });

    expect(result.id).toBeDefined();
    expect(result.title).toBe("Change logo color");
    expect(result.status).toBe("TODO");
    expect(result.priority).toBe("HIGH");
    expect(result.assignedTo?.id).toBe(user.id);
    expect(result.aiGenerated).toBe(false);
  });

  it("should create task without assignee", async () => {
    const tenant = await createTestTenant("agency-task-2");
    const client = await createTestClient(tenant.id, "client-task-2@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");

    const result = await taskService.createTask({
      projectId: project.id,
      tenantId: tenant.id,
      title: "Fix audio",
      priority: "MEDIUM",
      category: "SOUND",
    });

    expect(result.assignedTo).toBeNull();
    expect(result.sourceFeedbackIds).toEqual([]);
  });

  it("should trim title and apply defaults", async () => {
    const tenant = await createTestTenant("agency-task-3");
    const client = await createTestClient(tenant.id, "client-task-3@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");

    const result = await taskService.createTask({
      projectId: project.id,
      tenantId: tenant.id,
      title: "  Tighten cuts  ",
      priority: "LOW",
      category: "CONTENT",
    });

    expect(result.title).toBe("Tighten cuts");
    expect(result.status).toBe("TODO");
    expect(result.aiGenerated).toBe(false);
  });

  it("should fail when title is empty", async () => {
    const tenant = await createTestTenant("agency-task-4");
    const client = await createTestClient(tenant.id, "client-task-4@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");

    await expect(
      taskService.createTask({
        projectId: project.id,
        tenantId: tenant.id,
        title: "   ",
        priority: "LOW",
        category: "OTHER",
      }),
    ).rejects.toThrow("Title is required and must be under 200 characters");
  });

  it("should fail when title is longer than 200 characters", async () => {
    const tenant = await createTestTenant("agency-task-5");
    const client = await createTestClient(tenant.id, "client-task-5@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");

    await expect(
      taskService.createTask({
        projectId: project.id,
        tenantId: tenant.id,
        title: "a".repeat(201),
        priority: "LOW",
        category: "OTHER",
      }),
    ).rejects.toThrow("Title is required and must be under 200 characters");
  });

  it("should fail when estimatedMinutes is less than 1", async () => {
    const tenant = await createTestTenant("agency-task-6");
    const client = await createTestClient(tenant.id, "client-task-6@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");

    await expect(
      taskService.createTask({
        projectId: project.id,
        tenantId: tenant.id,
        title: "Task",
        priority: "LOW",
        category: "OTHER",
        estimatedMinutes: 0,
      }),
    ).rejects.toThrow("Estimated minutes must be at least 1");
  });

  it("should fail when due date is in the past", async () => {
    const tenant = await createTestTenant("agency-task-7");
    const client = await createTestClient(tenant.id, "client-task-7@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");

    await expect(
      taskService.createTask({
        projectId: project.id,
        tenantId: tenant.id,
        title: "Task",
        priority: "LOW",
        category: "OTHER",
        dueDate: new Date(Date.now() - 60 * 1000),
      }),
    ).rejects.toThrow("Due date cannot be in the past");
  });

  it("should fail if project not in tenant", async () => {
    const tenant1 = await createTestTenant("agency-task-8a");
    const tenant2 = await createTestTenant("agency-task-8b");
    const client1 = await createTestClient(tenant1.id, "client-task-8@test.com");
    const project1 = await createTestProject(tenant1.id, client1.id, "Project");

    await expect(
      taskService.createTask({
        projectId: project1.id,
        tenantId: tenant2.id,
        title: "Task",
        priority: "LOW",
        category: "OTHER",
      }),
    ).rejects.toThrow("Project not found in this tenant");
  });

  it("should fail when assignee is not in tenant", async () => {
    const tenant1 = await createTestTenant("agency-task-9a");
    const tenant2 = await createTestTenant("agency-task-9b");
    const foreignEditor = await createEditor(tenant2.id, "foreign-editor@test.com", "Foreign");
    const client1 = await createTestClient(tenant1.id, "client-task-9@test.com");
    const project1 = await createTestProject(tenant1.id, client1.id, "Project");

    await expect(
      taskService.createTask({
        projectId: project1.id,
        tenantId: tenant1.id,
        title: "Task",
        priority: "LOW",
        category: "OTHER",
        assignedToUserId: foreignEditor.id,
      }),
    ).rejects.toThrow("Assigned user not found in this tenant");
  });
});

describe("TaskService.createTasksFromActionItems", () => {
  beforeEach(async () => {
    await cleanup();
  });

  it("should create multiple tasks from action items", async () => {
    const tenant = await createTestTenant("agency-task-bulk-1");
    const client = await createTestClient(tenant.id, "client-task-bulk-1@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");

    const result = await taskService.createTasksFromActionItems({
      projectId: project.id,
      tenantId: tenant.id,
      actionItems: [
        {
          text: "Change logo",
          priority: "HIGH",
          category: "DESIGN",
          sourceFeedbackIds: ["fb-1"],
        },
        {
          text: "Fix audio",
          priority: "MEDIUM",
          category: "SOUND",
          sourceFeedbackIds: ["fb-2"],
        },
      ],
    });

    expect(result.length).toBe(2);
    expect(result[0].aiGenerated).toBe(true);
    expect(result[0].dueDate).toBeTruthy();
  });

  it("should fail when actionItems are empty", async () => {
    const tenant = await createTestTenant("agency-task-bulk-2");
    const client = await createTestClient(tenant.id, "client-task-bulk-2@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");

    await expect(
      taskService.createTasksFromActionItems({
        projectId: project.id,
        tenantId: tenant.id,
        actionItems: [],
      }),
    ).rejects.toThrow("Action items are required");
  });

  it("should fail if project not in tenant", async () => {
    const tenant1 = await createTestTenant("agency-task-bulk-3a");
    const tenant2 = await createTestTenant("agency-task-bulk-3b");
    const client1 = await createTestClient(tenant1.id, "client-task-bulk-3@test.com");
    const project1 = await createTestProject(tenant1.id, client1.id, "Project");

    await expect(
      taskService.createTasksFromActionItems({
        projectId: project1.id,
        tenantId: tenant2.id,
        actionItems: [
          {
            text: "Task",
            priority: "LOW",
            category: "OTHER",
            sourceFeedbackIds: [],
          },
        ],
      }),
    ).rejects.toThrow("Project not found in this tenant");
  });

  it("should auto-assign in round-robin using project members", async () => {
    const tenant = await createTestTenant("agency-task-bulk-4");
    const editor1 = await createEditor(tenant.id, "editor-bulk-1@test.com", "Ed1");
    const editor2 = await createEditor(tenant.id, "editor-bulk-2@test.com", "Ed2");
    const client = await createTestClient(tenant.id, "client-task-bulk-4@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");

    await prisma.projectMember.createMany({
      data: [
        { projectId: project.id, userId: editor1.id, roleOnProject: "editor" },
        { projectId: project.id, userId: editor2.id, roleOnProject: "editor" },
      ],
    });

    const result = await taskService.createTasksFromActionItems({
      projectId: project.id,
      tenantId: tenant.id,
      autoAssign: true,
      actionItems: [
        { text: "Task 1", priority: "HIGH", category: "DESIGN", sourceFeedbackIds: [] },
        { text: "Task 2", priority: "MEDIUM", category: "SOUND", sourceFeedbackIds: [] },
        { text: "Task 3", priority: "LOW", category: "CONTENT", sourceFeedbackIds: [] },
      ],
    });

    expect(result[0].assignedTo?.id).toBe(editor1.id);
    expect(result[1].assignedTo?.id).toBe(editor2.id);
    expect(result[2].assignedTo?.id).toBe(editor1.id);
  });

  it("should fallback to tenant editors when project has no editor members", async () => {
    const tenant = await createTestTenant("agency-task-bulk-5");
    const editor = await createEditor(tenant.id, "editor-bulk-5@test.com", "Solo");
    const client = await createTestClient(tenant.id, "client-task-bulk-5@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");

    const result = await taskService.createTasksFromActionItems({
      projectId: project.id,
      tenantId: tenant.id,
      autoAssign: true,
      actionItems: [{ text: "Task 1", priority: "HIGH", category: "DESIGN", sourceFeedbackIds: [] }],
    });

    expect(result[0].assignedTo?.id).toBe(editor.id);
  });

  it("should calculate due dates by priority", async () => {
    const tenant = await createTestTenant("agency-task-bulk-6");
    const client = await createTestClient(tenant.id, "client-task-bulk-6@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");

    const now = Date.now();

    const result = await taskService.createTasksFromActionItems({
      projectId: project.id,
      tenantId: tenant.id,
      actionItems: [
        { text: "Urgent", priority: "URGENT", category: "OTHER", sourceFeedbackIds: [] },
        { text: "Medium", priority: "MEDIUM", category: "OTHER", sourceFeedbackIds: [] },
        { text: "Low", priority: "LOW", category: "OTHER", sourceFeedbackIds: [] },
      ],
    });

    const urgentMs = (result[0].dueDate?.getTime() ?? 0) - now;
    const mediumMs = (result[1].dueDate?.getTime() ?? 0) - now;
    const lowMs = (result[2].dueDate?.getTime() ?? 0) - now;

    expect(urgentMs).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(urgentMs).toBeLessThan(25 * 60 * 60 * 1000);
    expect(mediumMs).toBeGreaterThan(47 * 60 * 60 * 1000);
    expect(mediumMs).toBeLessThan(49 * 60 * 60 * 1000);
    expect(lowMs).toBeGreaterThan(71 * 60 * 60 * 1000);
    expect(lowMs).toBeLessThan(73 * 60 * 60 * 1000);
  });
});

describe("TaskService read/update/delete", () => {
  beforeEach(async () => {
    await cleanup();
  });

  async function setupTask() {
    const tenant = await createTestTenant("agency-task-rud");
    const editor = await createEditor(tenant.id, `editor-${Date.now()}@test.com`, "Editor");
    const client = await createTestClient(tenant.id, `client-${Date.now()}@test.com`);
    const project = await createTestProject(tenant.id, client.id, "Project");

    const task = await taskService.createTask({
      projectId: project.id,
      tenantId: tenant.id,
      title: "Task",
      priority: "HIGH",
      category: "DESIGN",
      assignedToUserId: editor.id,
    });

    return { tenant, editor, client, project, task };
  }

  it("should get task by id", async () => {
    const { tenant, task } = await setupTask();

    const result = await taskService.getTaskById(task.id, tenant.id);
    expect(result.id).toBe(task.id);
    expect(result.title).toBe("Task");
  });

  it("should fail getTaskById for another tenant", async () => {
    const { task } = await setupTask();
    const foreignTenant = await createTestTenant("agency-task-rud-other");

    await expect(taskService.getTaskById(task.id, foreignTenant.id)).rejects.toThrow("Task not found");
  });

  it("should fail getTaskById when missing", async () => {
    const tenant = await createTestTenant("agency-task-rud-missing");
    await expect(taskService.getTaskById("missing", tenant.id)).rejects.toThrow("Task not found");
  });

  it("should list tasks with filters and tenant isolation", async () => {
    const tenant = await createTestTenant("agency-task-list-1");
    const editor = await createEditor(tenant.id, "editor-list-1@test.com", "Editor1");
    const client = await createTestClient(tenant.id, "client-list-1@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");

    const otherTenant = await createTestTenant("agency-task-list-2");
    const otherClient = await createTestClient(otherTenant.id, "client-list-2@test.com");
    const otherProject = await createTestProject(otherTenant.id, otherClient.id, "Project 2");

    await taskService.createTask({
      projectId: project.id,
      tenantId: tenant.id,
      title: "Design task",
      priority: "URGENT",
      category: "DESIGN",
      assignedToUserId: editor.id,
    });
    const doneTask = await taskService.createTask({
      projectId: project.id,
      tenantId: tenant.id,
      title: "Sound task",
      priority: "HIGH",
      category: "SOUND",
    });
    await taskService.updateTaskStatus({ taskId: doneTask.id, tenantId: tenant.id, status: "DONE" });

    await taskService.createTask({
      projectId: otherProject.id,
      tenantId: otherTenant.id,
      title: "Foreign task",
      priority: "URGENT",
      category: "OTHER",
    });

    const onlyDone = await taskService.listTasks(tenant.id, { status: "DONE" });
    expect(onlyDone.length).toBe(1);
    expect(onlyDone[0].title).toBe("Sound task");

    const byAssignee = await taskService.listTasks(tenant.id, { assignedToUserId: editor.id });
    expect(byAssignee.length).toBe(1);
    expect(byAssignee[0].title).toBe("Design task");
  });

  it("should sort list by priority desc, dueDate asc, createdAt desc", async () => {
    const tenant = await createTestTenant("agency-task-sort");
    const client = await createTestClient(tenant.id, "client-sort@test.com");
    const project = await createTestProject(tenant.id, client.id, "Project");

    const base = Date.now();
    const dueSoon = new Date(base + 24 * 60 * 60 * 1000);
    const dueLater = new Date(base + 48 * 60 * 60 * 1000);

    await taskService.createTask({
      projectId: project.id,
      tenantId: tenant.id,
      title: "High later",
      priority: "HIGH",
      category: "OTHER",
      dueDate: dueLater,
    });
    await taskService.createTask({
      projectId: project.id,
      tenantId: tenant.id,
      title: "High sooner",
      priority: "HIGH",
      category: "OTHER",
      dueDate: dueSoon,
    });
    await taskService.createTask({
      projectId: project.id,
      tenantId: tenant.id,
      title: "Urgent no due",
      priority: "URGENT",
      category: "OTHER",
    });

    const tasks = await taskService.listTasks(tenant.id, { projectId: project.id });
    expect(tasks[0].title).toBe("Urgent no due");
    expect(tasks[1].title).toBe("High sooner");
    expect(tasks[2].title).toBe("High later");
  });

  it("should fail listTasks for project outside tenant", async () => {
    const tenant1 = await createTestTenant("agency-task-list-foreign-a");
    const tenant2 = await createTestTenant("agency-task-list-foreign-b");
    const client = await createTestClient(tenant1.id, "client-foreign@test.com");
    const project = await createTestProject(tenant1.id, client.id, "Project");

    await expect(taskService.listTasks(tenant2.id, { projectId: project.id })).rejects.toThrow(
      "Project not found in this tenant",
    );
  });

  it("should update status and set completedAt when DONE", async () => {
    const { tenant, task } = await setupTask();

    const updated = await taskService.updateTaskStatus({
      taskId: task.id,
      tenantId: tenant.id,
      status: "DONE",
    });

    expect(updated.status).toBe("DONE");
    expect(updated.completedAt).toBeTruthy();
  });

  it("should clear completedAt when moving away from DONE", async () => {
    const { tenant, task } = await setupTask();

    await taskService.updateTaskStatus({
      taskId: task.id,
      tenantId: tenant.id,
      status: "DONE",
    });

    const updated = await taskService.updateTaskStatus({
      taskId: task.id,
      tenantId: tenant.id,
      status: "IN_PROGRESS",
    });

    expect(updated.status).toBe("IN_PROGRESS");
    expect(updated.completedAt).toBeNull();
  });

  it("should fail updateTaskStatus when status is missing", async () => {
    const { tenant, task } = await setupTask();

    await expect(
      taskService.updateTaskStatus({
        taskId: task.id,
        tenantId: tenant.id,
      }),
    ).rejects.toThrow("status is required");
  });

  it("should fail updateTaskStatus for task in other tenant", async () => {
    const { task } = await setupTask();
    const otherTenant = await createTestTenant("agency-task-update-other");

    await expect(taskService.updateTaskStatus({ taskId: task.id, tenantId: otherTenant.id, status: "DONE" })).rejects.toThrow(
      "Task not found",
    );
  });

  it("should assign task to user in same tenant", async () => {
    const { tenant, task } = await setupTask();
    const nextEditor = await createEditor(tenant.id, "editor-assign-next@test.com", "Next");

    const updated = await taskService.assignTask(task.id, nextEditor.id, tenant.id);

    expect(updated.assignedTo?.id).toBe(nextEditor.id);
  });

  it("should fail assignTask when user is not in tenant", async () => {
    const { tenant, task } = await setupTask();
    const otherTenant = await createTestTenant("agency-task-assign-foreign");
    const foreignEditor = await createEditor(otherTenant.id, "editor-foreign@test.com", "Foreign");

    await expect(taskService.assignTask(task.id, foreignEditor.id, tenant.id)).rejects.toThrow(
      "Assigned user not found in this tenant",
    );
  });

  it("should fail assignTask when task does not exist", async () => {
    const tenant = await createTestTenant("agency-task-assign-missing");
    const editor = await createEditor(tenant.id, "editor-missing@test.com", "Missing");

    await expect(taskService.assignTask("missing-task", editor.id, tenant.id)).rejects.toThrow("Task not found");
  });

  it("should delete task", async () => {
    const { tenant, task } = await setupTask();

    await taskService.deleteTask(task.id, tenant.id);

    const record = await prisma.aITask.findUnique({ where: { id: task.id } });
    expect(record).toBeNull();
  });

  it("should fail deleteTask for another tenant", async () => {
    const { task } = await setupTask();
    const otherTenant = await createTestTenant("agency-task-delete-other");

    await expect(taskService.deleteTask(task.id, otherTenant.id)).rejects.toThrow("Task not found");
  });

  it("should fail deleteTask when task does not exist", async () => {
    const tenant = await createTestTenant("agency-task-delete-missing");

    await expect(taskService.deleteTask("missing", tenant.id)).rejects.toThrow("Task not found");
  });
});
