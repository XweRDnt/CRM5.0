import { clientService } from "@/lib/services/client.service";
import { withAuth } from "@/lib/middleware/auth";
import { z } from "zod";
import { handleAPIError } from "@/lib/utils/api-error";

const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  companyName: z.string().max(200).optional(),
});

export const GET = withAuth(async (req) => {
  try {
    const clients = await clientService.listClients(req.user.tenantId);
    return Response.json(clients);
  } catch (error) {
    return handleAPIError(error);
  }
});

export const POST = withAuth(async (req) => {
  try {
    const body = createClientSchema.parse(await req.json());
    const client = await clientService.createClient({
      tenantId: req.user.tenantId,
      ...body,
    });
    return Response.json(client, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
});
