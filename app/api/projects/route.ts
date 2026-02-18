import { projectService } from "@/lib/services/project.service";
import { withAuth } from "@/lib/middleware/auth";
import { z } from "zod";
import { handleAPIError } from "@/lib/utils/api-error";
import { ProjectStatus } from "@/types";

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  clientId: z.string().min(1),
  description: z.string().max(5000).optional(),
  brief: z.string().max(10000).optional(),
  revisionsLimit: z.number().int().min(1).max(10).default(3),
});

const listProjectsSchema = z.object({
  clientId: z.string().min(1).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
});

export const GET = withAuth(async (req) => {
  try {
    const tenantId = req.user.tenantId;
    const url = new URL(req.url);
    const parsed = listProjectsSchema.parse({
      clientId: url.searchParams.get("clientId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });

    const filters = parsed.clientId || parsed.status ? parsed : undefined;
    const projects = await projectService.listProjects(tenantId, filters);

    return Response.json(projects);
  } catch (error) {
    return handleAPIError(error);
  }
});

export const POST = withAuth(async (req) => {
  try {
    const tenantId = req.user.tenantId;
    const body = await req.json();
    const validated = createProjectSchema.parse(body);
    const project = await projectService.createProject({
      tenantId,
      ...validated,
    });
    return Response.json(project, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
});
