import { z } from "zod";
import { withAuth } from "@/lib/middleware/auth";
import { AIService } from "@/lib/services/ai.service";
import { FeedbackService } from "@/lib/services/feedback.service";
import { ScopeGuardService } from "@/lib/services/scope-guard.service";
import { prisma } from "@/lib/utils/db";
import { APIError, handleAPIError } from "@/lib/utils/api-error";

const analyzeScopeSchema = z.object({
  feedbackId: z.string().min(1),
  projectId: z.string().min(1),
});

export const POST = withAuth(async (request) => {
  try {
    const tenantId = request.user.tenantId;
    const validated = analyzeScopeSchema.parse(await request.json());

    const feedbackService = new FeedbackService(prisma);
    const feedback = await feedbackService.getFeedbackById(validated.feedbackId, tenantId);

    const project = await prisma.project.findFirst({
      where: { id: validated.projectId, tenantId },
      select: { id: true, name: true, scopeDocUrl: true },
    });

    if (!project) {
      throw new APIError(404, "Project not found", "NOT_FOUND");
    }

    const aiService = new AIService();
    const analysis = await aiService.analyzeScopeCompliance({
      feedbackText: feedback.text,
      feedbackId: feedback.id,
      projectScope: project.scopeDocUrl || "No brief provided",
      projectName: project.name,
    });

    const scopeGuardService = new ScopeGuardService(prisma);
    const decision = await scopeGuardService.createScopeDecision({
      projectId: validated.projectId,
      feedbackItemId: validated.feedbackId,
      tenantId,
      aiLabel: analysis.label,
      aiConfidence: analysis.confidence,
      aiReasoning: analysis.reasoning,
    });

    return Response.json({ analysis, decision }, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});

