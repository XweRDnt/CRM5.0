import { NextRequest } from "next/server";
import { clientService } from "@/lib/services/client.service";
import { ok, fail } from "@/lib/utils/http";

export async function GET(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const data = await clientService.listClients({ tenantId: "stub-tenant" }, payload);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}