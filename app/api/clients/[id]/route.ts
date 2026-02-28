import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { assertOwnerOrPm } from "@/lib/services/access-control.service";
import { clientService } from "@/lib/services/client.service";
import { prisma } from "@/lib/utils/db";
import { APIError, handleAPIError } from "@/lib/utils/api-error";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const updateClientSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).nullable().optional(),
  companyName: z.string().max(200).nullable().optional(),
});

export const GET = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    assertOwnerOrPm(req.user);
    const { id } = paramsSchema.parse(await context.params);
    const client = await clientService.getClientById(id, req.user.tenantId);
    return Response.json(client, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});

export const PATCH = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    assertOwnerOrPm(req.user);
    const tenantId = req.user.tenantId;
    const { id } = paramsSchema.parse(await context.params);
    const payload = updateClientSchema.parse(await req.json());

    if (Object.keys(payload).length === 0) {
      throw new APIError(400, "At least one field is required", "BAD_REQUEST");
    }

    const updated = await prisma.clientAccount.updateMany({
      where: { id, tenantId },
      data: {
        contactName: payload.name,
        email: payload.email,
        phone: payload.phone === undefined ? undefined : payload.phone,
        companyName: payload.companyName === undefined ? undefined : payload.companyName ?? "",
      },
    });

    if (updated.count === 0) {
      throw new APIError(404, "Client not found", "NOT_FOUND");
    }

    const client = await clientService.getClientById(id, tenantId);
    return Response.json(client, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});

export const DELETE = withAuth(async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    assertOwnerOrPm(req.user);
    const tenantId = req.user.tenantId;
    const { id } = paramsSchema.parse(await context.params);

    const deleted = await prisma.clientAccount.deleteMany({
      where: { id, tenantId },
    });

    if (deleted.count === 0) {
      throw new APIError(404, "Client not found", "NOT_FOUND");
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
