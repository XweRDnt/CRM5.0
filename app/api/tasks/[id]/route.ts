import { z } from "zod";
import { TaskStatus } from "@prisma/client";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { assertProjectAccess } from "@/lib/services/access-control.service";
import { taskService } from "@/lib/services/task.service";
import { prisma } from "@/lib/utils/db";
import { APIError, handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const updateTaskSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  assignedToUserId: z.string().min(1).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

export const GET = withAuth(async (request: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const ref = await prisma.aITask.findUnique({ where: { id }, select: { projectId: true } });
    if (!ref) {
      throw new APIError(404, "Task not found", "NOT_FOUND");
    }
    await assertProjectAccess(request.user, ref.projectId);
    const task = await taskService.getTaskById(id, request.user.tenantId);
    return Response.json(task, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});

export const PATCH = withAuth(async (request: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const ref = await prisma.aITask.findUnique({ where: { id }, select: { projectId: true } });
    if (!ref) {
      throw new APIError(404, "Task not found", "NOT_FOUND");
    }
    await assertProjectAccess(request.user, ref.projectId);
    const payload = updateTaskSchema.parse(await request.json());

    if (Object.keys(payload).length === 0) {
      throw new APIError(400, "At least one field is required", "BAD_REQUEST");
    }

    const existing = await taskService.getTaskById(id, request.user.tenantId);
    const updated = await taskService.updateTaskStatus({
      taskId: id,
      tenantId: request.user.tenantId,
      status: payload.status ?? existing.status,
      assignedToUserId: payload.assignedToUserId === undefined ? undefined : payload.assignedToUserId ?? undefined,
      dueDate: payload.dueDate === undefined ? undefined : payload.dueDate ?? undefined,
      completedAt: payload.status === TaskStatus.DONE ? new Date() : undefined,
    });

    return Response.json(updated, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});

export const DELETE = withAuth(async (request: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const ref = await prisma.aITask.findUnique({ where: { id }, select: { projectId: true } });
    if (!ref) {
      throw new APIError(404, "Task not found", "NOT_FOUND");
    }
    await assertProjectAccess(request.user, ref.projectId);

    const deleted = await prisma.aITask.deleteMany({
      where: {
        id,
        project: {
          tenantId: request.user.tenantId,
        },
      },
    });

    if (deleted.count === 0) {
      throw new APIError(404, "Task not found", "NOT_FOUND");
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});

