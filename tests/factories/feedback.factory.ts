import { AuthorType as PrismaAuthorType, FeedbackStatus as PrismaFeedbackStatus } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { AuthorType, FeedbackStatus, type FeedbackItem } from "@/types";

export function makeFeedback(overrides: Partial<FeedbackItem> = {}): FeedbackItem {
  const now = new Date();
  return {
    id: "feedback_test",
    assetVersionId: "version_test",
    authorType: AuthorType.CLIENT,
    authorId: null,
    authorEmail: "client@example.com",
    authorName: "Client",
    text: "Please trim intro by 2 seconds.",
    status: FeedbackStatus.NEW,
    timecodeSec: 12,
    category: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export async function createTestFeedback(
  assetVersionId: string,
  text: string,
  authorType: PrismaAuthorType = PrismaAuthorType.CLIENT,
) {
  return prisma.feedbackItem.create({
    data: {
      assetVersionId,
      authorType,
      authorEmail: authorType === PrismaAuthorType.CLIENT ? "client@test.com" : null,
      authorName: authorType === PrismaAuthorType.CLIENT ? "Test Client" : null,
      text,
      status: PrismaFeedbackStatus.NEW,
    },
  });
}
