import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { addParseFeedbackJob } from "@/lib/jobs/queues/feedback.queue";
import type {
  CreateFeedbackInput,
  FeedbackResponse,
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
  category: "CONTENT" | "DESIGN" | "SOUND" | "LEGAL" | "OTHER" | null;
  status: "NEW" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
};

export class FeedbackService {
  constructor(private prismaClient: PrismaClient = prisma as PrismaClient) {}

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

    try {
      await addParseFeedbackJob({
        tenantId,
        projectId: version.project.id,
        feedbackIds: [feedback.id],
      });
    } catch (error) {
      console.error("Failed to queue feedback parsing job", error);
    }

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
      orderBy: { createdAt: "desc" },
    });

    return feedbackItems.map((feedback) => this.mapFeedbackResponse(feedback as FeedbackWithAuthor));
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
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt,
    };
  }
}

export const feedbackService = new FeedbackService();
