import { NextRequest } from "next/server";
import { storageService } from "@/lib/services/storage.service";
import { ok, fail } from "@/lib/utils/http";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const data = await storageService.getUploadUrl({ tenantId: "stub-tenant" }, payload);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}