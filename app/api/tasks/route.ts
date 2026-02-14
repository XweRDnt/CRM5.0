import { NextRequest } from "next/server";
import { taskService } from "@/lib/services/task.service";
import { ok, fail } from "@/lib/utils/http";

export async function GET(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const data = await taskService.listTasksByProject({ tenantId: "stub-tenant" }, payload);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}