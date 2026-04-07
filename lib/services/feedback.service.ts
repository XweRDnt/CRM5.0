import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { addParseFeedbackJob } from "@/lib/jobs/queues/feedback.queue";
import type {
  CreateFeedbackThreadMessageInput,
  CreateFeedbackInput,
  FeedbackResponse,
  FeedbackThreadMessageResponse,
  ListFeedbackWithThreadMetaInput,
  MarkFeedbackThreadReadInput,
  ServiceContext,
  UpdateFeedbackStatusInput,
} from "@/types";
import { FeedbackStatus } from "@/types";

type FeedbackWithAuthor = {
  id: string;
  assetVersionId: string;
  authorType: "USER" | "CLIENT";
  authorEmail: string | null;
  authorName: string | null;
  timecodeSec: number | null;
  text: string;
  annotationData: unknown | null;
  category: "CONTENT" | "DESIGN" | "SOUND" | "LEGAL" | "OTHER" | null;
  status: "NEW" | "VIEWED" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
  createdAt: Date;
  updatedAt: Date;
  author?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
};

export class FeedbackService {
  constructor(private prismaClient: PrismaClient = prisma as PrismaClient) {}

  private get threadMessageStore(): {
    create: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
  } {
    return (this.prismaClient as unknown as { feedbackThreadMessage: { create: (args: unknown) => Promise<unknown>; findMany: (args: unknown) => Promise<unknown[]> } }).feedbackThreadMessage;
  }

  private get threadReadStore(): {
    upsert: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<Array<{ feedbackItemId: string; lastReadAt: Date }>>;
  } {
    return (this.prismaClient as unknown as { feedbackThreadRead: { upsert: (args: unknown) => Promise<unknown>; findMany: (args: unknown) => Promise<Array<{ feedbackItemId: string; lastReadAt: Date }>> } }).feedbackThreadRead;
  }

  async createFeedback(input: CreateFeedbackInput): Promise<FeedbackResponse> {
    const {
      assetVersionId,
      tenantId,
      authorType,
      authorId,
      authorEmail,
      authorName,
      timecodeSec,
      text,
      category,
      annotationData,
    } = input;

    if (!text?.trim() || text.length > 5000) {
      throw new Error("Feedback text is required and must be under 5000 characters");
    }

    if (timecodeSec !== undefined && timecodeSec < 0) {
      throw new Error("Timecode must be non-negative");
    }

    const version = await this.prismaClient.assetVersion.findFirst({
      where: { id: assetVersionId },
      include: {
        project: {
          select: { id: true, tenantId: true },
        },
      },
    });

    if (!version) {
      throw new Error("Asset version not found");
    }

    if (version.project.tenantId !== tenantId) {
      throw new Error("Asset version not found in this tenant");
    }

    if (authorType === "USER") {
      if (!authorId) {
        throw new Error("authorId is required for USER type feedback");
      }

      const user = await this.prismaClient.user.findFirst({
        where: {
          id: authorId,
          tenantId,
        },
        select: { id: true },
      });

      if (!user) {
        throw new Error("User not found in this tenant");
      }
    }

    if (authorType === "CLIENT" && !authorEmail && !authorName) {
      throw new Error("authorEmail or authorName is required for CLIENT type feedback");
    }

    const feedback = await this.prismaClient.feedbackItem.create({
      data: {
        assetVersionId,
        authorType,
        authorId: authorId ?? null,
        authorEmail: authorEmail ?? null,
        authorName: authorName ?? null,
        timecodeSec: timecodeSec ?? null,
        text,
        category: category ?? null,
        annotationData: annotationData ?? Prisma.DbNull,
        status: FeedbackStatus.NEW,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    void addParseFeedbackJob({
      tenantId,
      projectId: version.project.id,
      feedbackIds: [feedback.id],
    }).catch((error) => {
      console.error("Failed to queue feedback parsing job", error);
    });

    return this.mapFeedbackResponse(feedback as FeedbackWithAuthor);
  }

  async getFeedbackById(feedbackId: string, tenantId: string): Promise<FeedbackResponse> {
    const feedback = await this.prismaClient.feedbackItem.findFirst({
      where: {
        id: feedbackId,
        assetVersion: {
          project: {
            tenantId,
          },
        },
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!feedback) {
      throw new Error("Feedback not found");
    }

    return this.mapFeedbackResponse(feedback as FeedbackWithAuthor);
  }

  async listFeedbackByVersion(versionId: string, tenantId: string): Promise<FeedbackResponse[]> {
    const version = await this.prismaClient.assetVersion.findFirst({
      where: {
        id: versionId,
        project: {
          tenantId,
        },
      },
      select: { id: true },
    });

    if (!version) {
      throw new Error("Asset version not found in this tenant");
    }

    const feedbackItems = await this.prismaClient.feedbackItem.findMany({
      where: { assetVersionId: versionId },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return feedbackItems.map((feedback) => this.mapFeedbackResponse(feedback as FeedbackWithAuthor));
  }

  async listFeedbackByProject(projectId: string, tenantId: string): Promise<FeedbackResponse[]> {
    const project = await this.prismaClient.project.findFirst({
      where: {
        id: projectId,
        tenantId,
      },
      select: { id: true },
    });

    if (!project) {
      throw new Error("Project not found in this tenant");
    }

    const feedbackItems = await this.prismaClient.feedbackItem.findMany({
      where: {
        assetVersion: {
          projectId,
        },
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return feedbackItems.map((feedback) => this.mapFeedbackResponse(feedback as FeedbackWithAuthor));
  }

  async listFeedbackByProjectWithThreadMeta(input: ListFeedbackWithThreadMetaInput): Promise<FeedbackResponse[]> {
    const { projectId, tenantId, viewerUserId, clientIdentity } = input;
    const feedbackItems = await this.listFeedbackByProject(projectId, tenantId);
    const feedbackIds = feedbackItems.map((item) => item.id);

    if (feedbackIds.length === 0) {
      return [];
    }

    const threadMessages = (await this.threadMessageStore.findMany({
      where: {
        feedbackItemId: {
          in: feedbackIds,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })) as Array<{
      id: string;
      feedbackItemId: string;
      text: string;
      createdAt: Date;
    }>;

    const reads = await this.threadReadStore.findMany({
      where: viewerUserId
        ? {
            feedbackItemId: { in: feedbackIds },
            userId: viewerUserId,
          }
        : {
            feedbackItemId: { in: feedbackIds },
            clientIdentity: clientIdentity ?? "__missing__",
          },
    });

    const lastReadMap = new Map(reads.map((item) => [item.feedbackItemId, item.lastReadAt]));
    const grouped = new Map<string, typeof threadMessages>();

    for (const message of threadMessages) {
      const bucket = grouped.get(message.feedbackItemId) ?? [];
      bucket.push(message);
      grouped.set(message.feedbackItemId, bucket);
    }

    return feedbackItems.map((item) => {
      const messages = grouped.get(item.id) ?? [];
      const lastReadAt = lastReadMap.get(item.id);
      const unreadCount = messages.filter((message) => !lastReadAt || message.createdAt > lastReadAt).length;
      const latest = messages[0] ?? null;

      return {
        ...item,
        threadMessageCount: messages.length,
        threadUnreadCount: unreadCount,
        lastThreadMessageAt: latest?.createdAt ?? null,
        lastThreadMessagePreview: latest?.text ?? null,
      };
    });
  }

  async createThreadMessage(input: CreateFeedbackThreadMessageInput): Promise<FeedbackThreadMessageResponse> {
    const { feedbackId, tenantId, authorType, authorUserId, authorRole, authorName, text } = input;

    if (!text?.trim() || text.trim().length > 5000) {
      throw new Error("Feedback thread text is required and must be under 5000 characters");
    }

    const feedback = await this.prismaClient.feedbackItem.findFirst({
      where: {
        id: feedbackId,
        assetVersion: {
          project: {
            tenantId,
          },
        },
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!feedback) {
      throw new Error("Feedback not found");
    }

    let resolvedAuthorName = authorName?.trim() ?? "";
    let resolvedRole = authorRole === "CLIENT" ? "Клиент" : authorRole ?? "";
    let resolvedEmail: string | undefined;

    if (authorType === "USER") {
      if (!authorUserId) {
        throw new Error("authorUserId is required for USER thread messages");
      }

      const user = await this.prismaClient.user.findFirst({
        where: {
          id: authorUserId,
          tenantId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      });

      if (!user) {
        throw new Error("User not found in this tenant");
      }

      resolvedAuthorName = `${user.firstName} ${user.lastName}`.trim();
      resolvedRole = user.role;
      resolvedEmail = user.email;
    } else if (!resolvedAuthorName) {
      resolvedAuthorName = feedback.authorName ?? feedback.author?.firstName ?? "Client";
    }

    const created = (await this.threadMessageStore.create({
      data: {
        feedbackItemId: feedbackId,
        authorType,
        authorUserId: authorType === "USER" ? authorUserId ?? null : null,
        authorName: resolvedAuthorName,
        authorRoleLabel: resolvedRole || "CLIENT",
        text: text.trim(),
      },
    })) as {
      id: string;
      feedbackItemId: string;
      authorType: "USER" | "CLIENT";
      authorUserId: string | null;
      authorName: string;
      authorRoleLabel: string;
      text: string;
      createdAt: Date;
    };

    return {
      id: created.id,
      feedbackItemId: created.feedbackItemId,
      authorType: created.authorType,
      author: {
        id: created.authorUserId ?? undefined,
        name: created.authorName,
        role: created.authorRoleLabel,
        email: resolvedEmail,
      },
      text: created.text,
      createdAt: created.createdAt,
    };
  }

  async markThreadRead(input: MarkFeedbackThreadReadInput): Promise<void> {
    const { feedbackId, tenantId, userId, clientIdentity } = input;

    if (!userId && !clientIdentity) {
      throw new Error("userId or clientIdentity is required");
    }

    const feedback = await this.prismaClient.feedbackItem.findFirst({
      where: {
        id: feedbackId,
        assetVersion: {
          project: {
            tenantId,
          },
        },
      },
      select: { id: true },
    });

    if (!feedback) {
      throw new Error("Feedback not found");
    }

    await this.threadReadStore.upsert({
      where: userId
        ? {
            feedbackItemId_userId: {
              feedbackItemId: feedbackId,
              userId,
            },
          }
        : {
            feedbackItemId_clientIdentity: {
              feedbackItemId: feedbackId,
              clientIdentity: clientIdentity ?? "",
            },
          },
      update: {
        lastReadAt: new Date(),
      },
      create: {
        feedbackItemId: feedbackId,
        userId: userId ?? null,
        clientIdentity: clientIdentity ?? null,
        lastReadAt: new Date(),
      },
    });
  }

  async markVersionFeedbackViewed(input: { versionId: string; tenantId: string }): Promise<void> {
    const { versionId, tenantId } = input;

    await this.prismaClient.feedbackItem.updateMany({
      where: {
        assetVersionId: versionId,
        status: FeedbackStatus.NEW,
        assetVersion: {
          project: {
            tenantId,
          },
        },
      },
      data: {
        status: FeedbackStatus.VIEWED,
      },
    });
  }

  async markVersionFeedbackInProgress(input: { versionId: string; tenantId: string }): Promise<void> {
    const { versionId, tenantId } = input;

    await this.prismaClient.feedbackItem.updateMany({
      where: {
        assetVersionId: versionId,
        status: {
          in: [FeedbackStatus.NEW, FeedbackStatus.VIEWED],
        },
        assetVersion: {
          project: {
            tenantId,
          },
        },
      },
      data: {
        status: FeedbackStatus.IN_PROGRESS,
      },
    });
  }

  async resolvePreviousVersionFeedback(input: { previousVersionId: string; tenantId: string }): Promise<void> {
    const { previousVersionId, tenantId } = input;

    await this.prismaClient.feedbackItem.updateMany({
      where: {
        assetVersionId: previousVersionId,
        status: {
          notIn: [FeedbackStatus.RESOLVED, FeedbackStatus.REJECTED],
        },
        assetVersion: {
          project: {
            tenantId,
          },
        },
      },
      data: {
        status: FeedbackStatus.RESOLVED,
      },
    });
  }

  async updateFeedbackStatus(input: UpdateFeedbackStatusInput): Promise<FeedbackResponse> {
    const { feedbackId, tenantId, status } = input;

    const existing = await this.prismaClient.feedbackItem.findFirst({
      where: {
        id: feedbackId,
        assetVersion: {
          project: {
            tenantId,
          },
        },
      },
      select: { id: true },
    });

    if (!existing) {
      throw new Error("Feedback not found");
    }

    const updated = await this.prismaClient.feedbackItem.update({
      where: { id: feedbackId },
      data: { status },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return this.mapFeedbackResponse(updated as FeedbackWithAuthor);
  }

  async deleteFeedback(feedbackId: string, tenantId: string): Promise<void> {
    const feedback = await this.prismaClient.feedbackItem.findFirst({
      where: {
        id: feedbackId,
        assetVersion: {
          project: {
            tenantId,
          },
        },
      },
      select: { id: true },
    });

    if (!feedback) {
      throw new Error("Feedback not found");
    }

    await this.prismaClient.feedbackItem.delete({
      where: { id: feedbackId },
    });
  }

  async getFeedbackByProject(context: ServiceContext, input?: { projectId?: string }): Promise<FeedbackResponse[]> {
    if (!input?.projectId) {
      throw new Error("projectId is required");
    }

    return this.listFeedbackByProject(input.projectId, context.tenantId);
  }

  async updateStatus(
    context: ServiceContext,
    input?: { feedbackId?: string; status?: FeedbackStatus },
  ): Promise<FeedbackResponse> {
    if (!input?.feedbackId || !input?.status) {
      throw new Error("feedbackId and status are required");
    }

    return this.updateFeedbackStatus({
      feedbackId: input.feedbackId,
      status: input.status,
      tenantId: context.tenantId,
    });
  }

  async assignOwner(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }

  async bulkImportFeedback(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }

  async deduplicateFeedback(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }

  private mapFeedbackResponse(feedback: FeedbackWithAuthor): FeedbackResponse {
    return {
      id: feedback.id,
      assetVersionId: feedback.assetVersionId,
      authorType: feedback.authorType,
      author: {
        id: feedback.author?.id,
        name: feedback.author
          ? `${feedback.author.firstName} ${feedback.author.lastName}`.trim()
          : feedback.authorName || "Anonymous",
        email: feedback.author?.email || feedback.authorEmail || undefined,
      },
      timecodeSec: feedback.timecodeSec,
      text: feedback.text,
      category: feedback.category,
      status: feedback.status,
      annotationData: (feedback.annotationData as FeedbackResponse["annotationData"]) ?? null,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt,
    };
  }
}
