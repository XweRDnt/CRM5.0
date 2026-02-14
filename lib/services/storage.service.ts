import type { ServiceContext } from "@/types";

export class StorageService {
  async getUploadUrl(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async getDownloadUrl(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async deleteObject(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async moveObject(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async validateUploadMetadata(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async generatePublicThumbnailUrl(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async copyObject(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async healthCheckStorage(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
}

export const storageService = new StorageService();
