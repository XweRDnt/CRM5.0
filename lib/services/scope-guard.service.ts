import type { ServiceContext } from "@/types";

export class ScopeGuardService {
  async createScopeDecision(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async makePMDecision(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async listScopeDecisions(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async analyzeFeedbackScope(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async flagPotentialScopeRisk(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async generateChangeRequestDraft(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async overrideDecision(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async getScopeMetrics(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
}

export const scopeGuardService = new ScopeGuardService();
