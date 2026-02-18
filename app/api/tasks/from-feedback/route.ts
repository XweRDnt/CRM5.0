import { z } from "zod";
import { withAuth } from "@/lib/middleware/auth";
import { AIService } from "@/lib/services/ai.service";
import { FeedbackService } from "@/lib/services/feedback.service";
import { TaskService } from "@/lib/services/task.service";
import { prisma } from "@/lib/utils/db";
import { APIError, handleAPIError } from "@/lib/utils/api-error";

const createTasksFromFeedbackSchema = z.object({
  projectId: z.string().min(1),
  feedbackIds: z.array(z.string().min(1)).min(1),
  autoAssign: z.boolean().default(true),
});

export const POST = withAuth(async (req) => {
  try {
    const tenantId = req.user.tenantId;
    const validated = createTasksFromFeedbackSchema.parse(await req.json());

    const feedbackService = new FeedbackService(prisma);
    const feedbackItems = await Promise.all(
      validated.feedbackIds.map((id) => feedbackService.getFeedbackById(id, tenantId)),
    );

    const project = await prisma.project.findFirst({
      where: { id: validated.projectId, tenantId },
      select: { id: true, name: true, scopeDocUrl: true },
    });

    if (!project) {
      throw new APIError(404, "Project not found", "NOT_FOUND");
    }

    const aiService = new AIService();
    const parsed = await aiService.parseFeedback({
      feedbackItems: feedbackItems.map((feedback) => ({
        id: feedback.id,
        text: feedback.text,
        timecodeSec: feedback.timecodeSec ?? undefined,
        category: feedback.category ?? undefined,
        authorName: feedback.author.name,
      })),
      projectContext: {
        name: project.name,
        brief: project.scopeDocUrl ?? undefined,
      },
    });

    const taskService = new TaskService(prisma);
    const tasks = await taskService.createTasksFromActionItems({
      projectId: validated.projectId,
      tenantId,
      actionItems: parsed.actionItems,
      autoAssign: validated.autoAssign,
    });

    return Response.json(
      {
        summary: parsed.summary,
        tasksCreated: tasks.length,
        tasks,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleAPIError(error);
  }
});

