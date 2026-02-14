import type { ServiceContext } from "@/types";

export class NotificationService {
  async sendEmail(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async sendSlackNotification(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async sendSmsNotification(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async notifyPMAboutNewFeedback(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async notifyClientAboutNewVersion(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async notifyTaskAssigned(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async notifyStageOverdue(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
  async sendDigest(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error('Not implemented');
  }
}

export const notificationService = new NotificationService();
