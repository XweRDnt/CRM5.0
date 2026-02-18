import { z } from "zod";
import { FeedbackCategory, TaskPriority, TaskStatus } from "@prisma/client";
import { withAuth } from "@/lib/middleware/auth";
import { taskService } from "@/lib/services/task.service";
import { handleAPIError } from "@/lib/utils/api-error";

const listTasksSchema = z.object({
  projectId: z.string().min(1).optional(),
  assignedToUserId: z.string().min(1).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  category: z.nativeEnum(FeedbackCategory).optional(),
});

const createTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  priority: z.nativeEnum(TaskPriority),
  category: z.nativeEnum(FeedbackCategory),
  assignedToUserId: z.string().min(1).optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  dueDate: z.coerce.date().optional(),
  sourceFeedbackIds: z.array(z.string().min(1)).optional(),
  aiGenerated: z.boolean().optional(),
});

export const GET = withAuth(async (request) => {
  try {
    const url = new URL(request.url);
    const filters = listTasksSchema.parse({
      projectId: url.searchParams.get("projectId") ?? undefined,
      assignedToUserId: url.searchParams.get("assignedToUserId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      priority: url.searchParams.get("priority") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
    });

    const tasks = await taskService.listTasks(request.user.tenantId, filters);
    return Response.json(tasks, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const payload = createTaskSchema.parse(await request.json());
    const task = await taskService.createTask({
      ...payload,
      tenantId: request.user.tenantId,
    });
    return Response.json(task, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
});

