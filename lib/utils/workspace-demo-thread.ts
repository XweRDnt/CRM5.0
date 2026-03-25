import type { AuthUser } from "@/lib/hooks/use-auth-guard";
import type { FeedbackThreadMessageResponse } from "@/types";

export function canReplyInWorkspaceThread(user: AuthUser | null | undefined): boolean {
  if (!user) {
    return false;
  }

  return user.isDemo === true || user.role === "OWNER" || user.role === "PM";
}

export function appendWorkspaceDemoThreadMessage(
  current: Record<string, FeedbackThreadMessageResponse[]>,
  feedbackId: string,
  user: AuthUser,
  text: string,
  createdAt: Date = new Date(),
): Record<string, FeedbackThreadMessageResponse[]> {
  const message: FeedbackThreadMessageResponse = {
    id: `demo-${feedbackId}-${createdAt.getTime()}`,
    feedbackItemId: feedbackId,
    authorType: "USER",
    author: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim() || user.email,
      role: user.role,
      email: user.email,
    },
    text,
    createdAt,
  };

  return {
    ...current,
    [feedbackId]: [...(current[feedbackId] ?? []), message],
  };
}
