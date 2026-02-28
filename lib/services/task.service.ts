import type { Prisma, PrismaClient, TaskStatus as PrismaTaskStatus } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import type {
  ActionItem,
  CreateTaskInput,
  CreateTasksFromActionItemsInput,
  TaskFilters,
  TaskResponse,
  UpdateTaskInput,
} from "@/types";

type TaskWithAssignee = Prisma.AITaskGetPayload<{
  include: {
    assignedTo: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
      };
    };
  };
}>;

export class TaskService {
  constructor(private prismaClient: PrismaClient = prisma as PrismaClient) {}

  async createTask(input: CreateTaskInput): Promise<TaskResponse> {
    const {
      projectId,
      tenantId,
      title,
      description,
      priority,
      category,
      assignedToUserId,
      estimatedMinutes,
      dueDate,
      sourceFeedbackIds,
      aiGenerated,
    } = input;

    const trimmedTitle = title?.trim();
    if (!trimmedTitle || trimmedTitle.length > 200) {
      throw new Error("Title is required and must be under 200 characters");
    }

    if (estimatedMinutes !== undefined && estimatedMinutes < 1) {
      throw new Error("Estimated minutes must be at least 1");
    }

    if (dueDate && dueDate < new Date()) {
      throw new Error("Due date cannot be in the past");
    }

    const project = await this.prismaClient.project.findFirst({
      where: {
        id: projectId,
        tenantId,
      },
      select: { id: true },
    });

    if (!project) {
      throw new Error("Project not found in this tenant");
    }

    if (assignedToUserId) {
      const user = await this.prismaClient.user.findFirst({
        where: {
          id: assignedToUserId,
          tenantId,
        },
        select: { id: true },
      });

      if (!user) {
        throw new Error("Assigned user not found in this tenant");
      }
    }

    const task = await this.prismaClient.aITask.create({
      data: {
        projectId,
        title: trimmedTitle,
        description: description ?? null,
        status: "TODO",
        priority,
        category,
        assignedToUserId: assignedToUserId ?? null,
        estimatedMinutes: estimatedMinutes ?? null,
        dueDate: dueDate ?? null,
        sourceFeedbackIds: sourceFeedbackIds ?? [],
        aiGenerated: aiGenerated ?? false,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return this.mapTaskResponse(task);
  }

  async createTasksFromActionItems(input: CreateTasksFromActionItemsInput): Promise<TaskResponse[]> {
    const { projectId, tenantId, actionItems, autoAssign } = input;

    if (!actionItems || actionItems.length === 0) {
      throw new Error("Action items are required");
    }

    const project = await this.prismaClient.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true },
    });

    if (!project) {
      throw new Error("Project not found in this tenant");
    }

    let editors: Array<{ id: string }> = [];
    if (autoAssign) {
      const projectEditors = await this.prismaClient.projectMember.findMany({
        where: {
          projectId,
          user: {
            tenantId,
            role: "EDITOR",
          },
        },
        select: {
          user: {
            select: { id: true },
          },
        },
      });

      if (projectEditors.length > 0) {
        editors = projectEditors.map((item) => ({ id: item.user.id }));
      } else {
        editors = await this.prismaClient.user.findMany({
          where: {
            tenantId,
            role: "EDITOR",
          },
          select: { id: true },
        });
      }
    }

    const tasks: TaskResponse[] = [];
    let editorIndex = 0;

    for (const item of actionItems) {
      const assignee = autoAssign && editors.length > 0 ? editors[editorIndex % editors.length].id : undefined;
      editorIndex += 1;

      const dueDate = this.calculateDueDate(item.priority);
      const task = await this.createTask({
        projectId,
        tenantId,
        title: item.text,
        priority: item.priority,
        category: item.category,
        assignedToUserId: assignee,
        estimatedMinutes: item.estimatedMinutes,
        dueDate,
        sourceFeedbackIds: item.sourceFeedbackIds,
        aiGenerated: true,
      });

      tasks.push(task);
    }

    return tasks;
  }

  async getTaskById(taskId: string, tenantId: string): Promise<TaskResponse> {
    const task = await this.prismaClient.aITask.findFirst({
      where: {
        id: taskId,
        project: {
          tenantId,
        },
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!task) {
      throw new Error("Task not found");
    }

    return this.mapTaskResponse(task);
  }

  async listTasks(
    tenantId: string,
    filters?: TaskFilters,
    options?: { accessibleProjectIds?: string[] },
  ): Promise<TaskResponse[]> {
    const accessibleProjectIds = options?.accessibleProjectIds;

    let projectIdFilter: string | { in: string[] } | undefined = filters?.projectId;
    if (accessibleProjectIds) {
      projectIdFilter = filters?.projectId
        ? accessibleProjectIds.includes(filters.projectId)
          ? filters.projectId
          : { in: [] }
        : { in: accessibleProjectIds };
    }

    if (filters?.projectId) {
      const project = await this.prismaClient.project.findFirst({
        where: {
          id: filters.projectId,
          tenantId,
        },
        select: { id: true },
      });

      if (!project) {
        throw new Error("Project not found in this tenant");
      }
    }

    const tasks = await this.prismaClient.aITask.findMany({
      where: {
        project: {
          tenantId,
        },
        projectId: projectIdFilter,
        assignedToUserId: filters?.assignedToUserId,
        status: filters?.status,
        priority: filters?.priority,
        category: filters?.category,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { priority: "desc" },
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
    });

    return tasks.map((task) => this.mapTaskResponse(task));
  }

  async updateTaskStatus(input: UpdateTaskInput): Promise<TaskResponse> {
    const { taskId, tenantId, status, assignedToUserId, dueDate, completedAt } = input;

    if (!status) {
      throw new Error("status is required");
    }

    const existing = await this.prismaClient.aITask.findFirst({
      where: {
        id: taskId,
        project: {
          tenantId,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      throw new Error("Task not found");
    }

    if (assignedToUserId) {
      const user = await this.prismaClient.user.findFirst({
        where: {
          id: assignedToUserId,
          tenantId,
        },
        select: { id: true },
      });

      if (!user) {
        throw new Error("Assigned user not found in this tenant");
      }
    }

    if (dueDate && dueDate < new Date()) {
      throw new Error("Due date cannot be in the past");
    }

    const resolvedCompletedAt = status === "DONE" ? completedAt ?? new Date() : completedAt ?? null;

    const updated = await this.prismaClient.aITask.update({
      where: { id: taskId },
      data: {
        status,
        assignedToUserId: assignedToUserId ?? undefined,
        dueDate: dueDate ?? undefined,
        completedAt: resolvedCompletedAt,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return this.mapTaskResponse(updated);
  }

  async assignTask(taskId: string, userId: string, tenantId: string): Promise<TaskResponse> {
    const existing = await this.prismaClient.aITask.findFirst({
      where: {
        id: taskId,
        project: {
          tenantId,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      throw new Error("Task not found");
    }

    const user = await this.prismaClient.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
      select: { id: true },
    });

    if (!user) {
      throw new Error("Assigned user not found in this tenant");
    }

    const updated = await this.prismaClient.aITask.update({
      where: { id: taskId },
      data: {
        assignedToUserId: userId,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return this.mapTaskResponse(updated);
  }

  async deleteTask(taskId: string, tenantId: string): Promise<void> {
    const existing = await this.prismaClient.aITask.findFirst({
      where: {
        id: taskId,
        project: {
          tenantId,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      throw new Error("Task not found");
    }

    await this.prismaClient.aITask.delete({
      where: { id: taskId },
    });
  }

  private calculateDueDate(priority: ActionItem["priority"]): Date {
    const dueDate = new Date();

    switch (priority) {
      case "URGENT":
      case "HIGH":
        dueDate.setHours(dueDate.getHours() + 24);
        break;
      case "MEDIUM":
        dueDate.setHours(dueDate.getHours() + 48);
        break;
      case "LOW":
        dueDate.setHours(dueDate.getHours() + 72);
        break;
    }

    return dueDate;
  }

  private mapTaskResponse(task: TaskWithAssignee): TaskResponse {
    return {
      id: task.id,
      projectId: task.projectId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      category: task.category,
      assignedTo: task.assignedTo
        ? {
            id: task.assignedTo.id,
            name: `${task.assignedTo.firstName} ${task.assignedTo.lastName}`.trim(),
          }
        : null,
      estimatedMinutes: task.estimatedMinutes,
      dueDate: task.dueDate,
      completedAt: task.completedAt,
      sourceFeedbackIds: task.sourceFeedbackIds ?? [],
      aiGenerated: task.aiGenerated,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}

export const taskService = new TaskService();
