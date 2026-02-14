import { NextRequest } from "next/server";
import { projectService } from "@/lib/services/project.service";
import { ok, fail } from "@/lib/utils/http";

export async function GET(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const data = await projectService.getProjectById({ tenantId: "stub-tenant" }, payload);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}