import { prisma } from "@/lib/utils/db";
import type { ClientResponse, CreateClientInput, ServiceContext } from "@/types";

export class ClientService {
  private mapClientResponse(client: {
    id: string;
    tenantId: string;
    contactName: string;
    email: string;
    phone: string | null;
    companyName: string;
    createdAt: Date;
    updatedAt: Date;
  }): ClientResponse {
    return {
      id: client.id,
      tenantId: client.tenantId,
      name: client.contactName,
      email: client.email,
      phone: client.phone,
      companyName: client.companyName.trim().length > 0 ? client.companyName : null,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }

  async createClient(input: CreateClientInput): Promise<ClientResponse> {
    const tenantId = input.tenantId?.trim();
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();

    if (!tenantId) {
      throw new Error("tenantId is required");
    }
    if (!name || name.length < 1 || name.length > 200) {
      throw new Error("Name must be between 1 and 200 characters");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const existingClient = await prisma.clientAccount.findFirst({
      where: { tenantId, email },
      select: { id: true },
    });
    if (existingClient) {
      throw new Error("Client with this email already exists");
    }

    const created = await prisma.clientAccount.create({
      data: {
        tenantId,
        contactName: name,
        email,
        phone: input.phone?.trim() || null,
        companyName: input.companyName?.trim() ?? "",
      },
    });

    return this.mapClientResponse(created);
  }

  async getClientById(clientId: string, tenantId: string): Promise<ClientResponse> {
    if (!tenantId || tenantId.trim().length === 0) {
      throw new Error("tenantId is required");
    }

    const client = await prisma.clientAccount.findFirst({
      where: {
        id: clientId,
        tenantId,
      },
    });

    if (!client) {
      throw new Error("Client not found");
    }

    return this.mapClientResponse(client);
  }

  async listClients(tenantId: string): Promise<ClientResponse[]> {
    if (!tenantId || tenantId.trim().length === 0) {
      throw new Error("tenantId is required");
    }

    const clients = await prisma.clientAccount.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    return clients.map((client) => this.mapClientResponse(client));
  }

  async updateClient(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }

  async archiveClient(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }

  async linkClientToProject(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }

  async getClientProjects(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }

  async searchClients(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }
}

export const clientService = new ClientService();
