import { projectService } from "@/lib/services/project.service";
import { withAuth } from "@/lib/middleware/auth";
import { z } from "zod";
import { handleAPIError } from "@/lib/utils/api-error";
import { assertOwnerOrPm } from "@/lib/services/access-control.service";
import { billingGuardService } from "@/lib/services/billing-guard.service";
import { withServerTiming } from "@/lib/utils/server-timing";
import { ProjectStatus } from "@/types";

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
});

const listProjectsSchema = z.object({
  status: z.nativeEnum(ProjectStatus).optional(),
});

export const GET = withAuth(async (req) => {
  return withServerTiming("projects-list", async () => {
    try {
      const tenantId = req.user.tenantId;
      const url = new URL(req.url);
      const parsed = listProjectsSchema.parse({
        status: url.searchParams.get("status") ?? undefined,
      });

      const filters = parsed.status ? parsed : undefined;
      const projects = await projectService.listProjects(tenantId, filters, req.user);

      return Response.json(projects);
    } catch (error) {
      return handleAPIError(error);
    }
  });
});

export const POST = withAuth(async (req) => {
  try {
    assertOwnerOrPm(req.user);
    const tenantId = req.user.tenantId;
    await billingGuardService.assertCanCreateProject(tenantId);
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
