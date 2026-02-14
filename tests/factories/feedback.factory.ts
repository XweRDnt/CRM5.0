import { FeedbackStatus, type FeedbackItem } from "@/types";

export function makeFeedback(overrides: Partial<FeedbackItem> = {}): FeedbackItem {
  const now = new Date();
  return {
    id: "feedback_test",
    assetVersionId: "version_test",
    text: "Please trim intro by 2 seconds.",
    status: FeedbackStatus.NEW,
    timecodeSec: 12,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
