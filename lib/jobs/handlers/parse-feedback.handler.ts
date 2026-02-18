import type {
  CreateTasksFromActionItemsInput,
  FeedbackResponse,
  ParseFeedbackInput,
  ParsedFeedbackResult,
  TaskResponse,
} from "@/types";
import { prisma } from "@/lib/utils/db";
import { AIService } from "@/lib/services/ai.service";
import { FeedbackService } from "@/lib/services/feedback.service";
import { TaskService } from "@/lib/services/task.service";
import type { ParseFeedbackJobData } from "@/lib/jobs/queues/feedback.queue";

type ParseFeedbackProject = {
  id: string;
  name: string;
  description: string | null;
};

type ParseFeedbackHandlerDependencies = {
  getFeedbackById: (feedbackId: string, tenantId: string) => Promise<FeedbackResponse>;
  getProject: (projectId: string, tenantId: string) => Promise<ParseFeedbackProject | null>;
  parseFeedback: (input: ParseFeedbackInput) => Promise<ParsedFeedbackResult>;
  createTasksFromActionItems: (input: CreateTasksFromActionItemsInput) => Promise<TaskResponse[]>;
  logInfo: (message: string) => void;
  logError: (message: string, error?: unknown) => void;
};

function getDefaultDependencies(): ParseFeedbackHandlerDependencies {
  const feedbackService = new FeedbackService();
  const aiService = new AIService();
  const taskService = new TaskService();

  return {
    getFeedbackById: (feedbackId: string, tenantId: string) => feedbackService.getFeedbackById(feedbackId, tenantId),
    getProject: (projectId: string, tenantId: string) =>
      prisma.project.findFirst({
        where: {
          id: projectId,
          tenantId,
        },
        select: {
          id: true,
          name: true,
          description: true,
        },
      }),
    parseFeedback: (input: ParseFeedbackInput) => aiService.parseFeedback(input),
    createTasksFromActionItems: (input: CreateTasksFromActionItemsInput) => taskService.createTasksFromActionItems(input),
    logInfo: (message: string) => console.info(message),
    logError: (message: string, error?: unknown) => console.error(message, error),
  };
}

export function createParseFeedbackHandler(
  overrides: Partial<ParseFeedbackHandlerDependencies> = {},
): (data: ParseFeedbackJobData) => Promise<void> {
  const deps = { ...getDefaultDependencies(), ...overrides };

  return async (data: ParseFeedbackJobData): Promise<void> => {
    const { tenantId, projectId, feedbackIds } = data;
    deps.logInfo(`[Parse Feedback Job] Starting for project ${projectId}`);

    try {
      if (feedbackIds.length === 0) {
        throw new Error("feedbackIds is required");
      }

      const feedbackItems = await Promise.all(
        feedbackIds.map((feedbackId) => deps.getFeedbackById(feedbackId, tenantId)),
      );

      const project = await deps.getProject(projectId, tenantId);
      if (!project) {
        throw new Error("Project not found");
      }

      const parsed = await deps.parseFeedback({
        feedbackItems: feedbackItems.map((feedback) => ({
          id: feedback.id,
          text: feedback.text,
          timecodeSec: feedback.timecodeSec ?? undefined,
          category: feedback.category ?? undefined,
          authorName: feedback.author.name,
        })),
        projectContext: {
          name: project.name,
          brief: project.description ?? undefined,
        },
      });

      deps.logInfo(`[Parse Feedback Job] AI parsed ${parsed.actionItems.length} action items`);

      if (parsed.actionItems.length > 0) {
        const tasks = await deps.createTasksFromActionItems({
          projectId,
          tenantId,
          actionItems: parsed.actionItems,
          autoAssign: true,
        });
        deps.logInfo(`[Parse Feedback Job] Created ${tasks.length} tasks`);
      }

      deps.logInfo("[Parse Feedback Job] Completed successfully");
    } catch (error) {
      deps.logError("[Parse Feedback Job] Failed", error);
      throw error;
    }
  };
}

export const handleParseFeedback = createParseFeedbackHandler();
