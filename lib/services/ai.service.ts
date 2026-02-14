import type { ServiceContext } from "@/types";

export class AiService {
  async parseFeedback(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async analyzeScopeCompliance(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async generateClientUpdate(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async transcribeAudioFeedback(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async categorizeFeedback(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async estimateTaskPriority(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async dedupeActionItems(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async healthCheck(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
}

export const aiService = new AiService();
