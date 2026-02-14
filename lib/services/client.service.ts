import type { ServiceContext } from "@/types";

export class ClientService {
  async createClient(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async listClients(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async getClientById(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async updateClient(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async archiveClient(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async linkClientToProject(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async getClientProjects(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async searchClients(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
}

export const clientService = new ClientService();
