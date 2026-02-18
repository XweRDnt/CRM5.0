export class AIService {
  async parseFeedback(input: { feedbackItems: Array<{ id?: string }> }) {
    return {
      summary: "Mock summary",
      actionItems: [
        {
          text: "Mock action",
          priority: "MEDIUM",
          category: "DESIGN",
          sourceFeedbackIds: [input.feedbackItems[0]?.id],
        },
      ],
      dedupedCount: 0,
      totalFeedbackProcessed: input.feedbackItems.length,
    };
  }

  async extractActionItems() {
    return [];
  }

  async generateClientUpdate() {
    return {
      subject: "Mock subject",
      body: "Mock body",
      tone: "professional" as const,
    };
  }
}
