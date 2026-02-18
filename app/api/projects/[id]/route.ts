import { z } from "zod";
import { ProjectStatus } from "@prisma/client";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { projectService } from "@/lib/services/project.service";
import { prisma } from "@/lib/utils/db";
import { APIError, handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  clientId: z.string().min(1).optional(),
  brief: z.string().max(10000).nullable().optional(),
  revisionsLimit: z.number().int().min(1).max(10).optional(),
});

export const GET = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const project = await projectService.getProjectById(id, req.user.tenantId);
    return Response.json(project, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});

export const PATCH = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = paramsSchema.parse(await context.params);
    const payload = updateProjectSchema.parse(await req.json());

    if (Object.keys(payload).length === 0) {
      throw new APIError(400, "At least one field is required", "BAD_REQUEST");
    }

    if (payload.clientId) {
      const client = await prisma.clientAccount.findFirst({
        where: { id: payload.clientId, tenantId },
        select: { id: true },
      });
      if (!client) {
        throw new APIError(404, "Client not found", "NOT_FOUND");
      }
    }

    const updated = await prisma.project.updateMany({
      where: { id, tenantId },
      data: {
        name: payload.name,
        description: payload.description === undefined ? undefined : payload.description,
        status: payload.status,
        clientAccountId: payload.clientId,
        scopeDocUrl: payload.brief === undefined ? undefined : payload.brief,
        maxRevisions: payload.revisionsLimit,
      },
    });

    if (updated.count === 0) {
      throw new APIError(404, "Project not found", "NOT_FOUND");
    }

    const project = await projectService.getProjectById(id, tenantId);
    return Response.json(project, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});

export const DELETE = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = paramsSchema.parse(await context.params);

    const deleted = await prisma.project.deleteMany({
      where: { id, tenantId },
    });

    if (deleted.count === 0) {
      throw new APIError(404, "Project not found", "NOT_FOUND");
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
