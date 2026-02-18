import { describe, expect, it, vi } from "vitest";
import { createParseFeedbackHandler } from "@/lib/jobs/handlers/parse-feedback.handler";
import type { ParseFeedbackJobData } from "@/lib/jobs/queues/feedback.queue";
import type { FeedbackResponse, ParseFeedbackInput, ParsedFeedbackResult } from "@/types";

function makeFeedback(overrides: Partial<FeedbackResponse> = {}): FeedbackResponse {
  const now = new Date();
  return {
    id: "feedback-1",
    assetVersionId: "version-1",
    authorType: "CLIENT",
    author: {
      name: "Client User",
      email: "client@test.com",
    },
    timecodeSec: 14,
    text: "Fix logo on intro",
    category: "DESIGN",
    status: "NEW",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeParsed(overrides: Partial<ParsedFeedbackResult> = {}): ParsedFeedbackResult {
  return {
    summary: "Summary",
    actionItems: [
      {
        text: "Fix logo on intro",
        priority: "HIGH",
        category: "DESIGN",
        estimatedMinutes: 10,
        sourceFeedbackIds: ["feedback-1"],
      },
    ],
    dedupedCount: 0,
    totalFeedbackProcessed: 1,
    ...overrides,
  };
}

function makeJobData(overrides: Partial<ParseFeedbackJobData> = {}): ParseFeedbackJobData {
  return {
    tenantId: "tenant-1",
    projectId: "project-1",
    feedbackIds: ["feedback-1"],
    ...overrides,
  };
}

describe("createParseFeedbackHandler", () => {
  it("parses feedback and creates tasks", async () => {
    const getFeedbackById = vi.fn(async () => makeFeedback());
    const getProject = vi.fn(async () => ({ id: "project-1", name: "Project", description: "Short brief" }));
    const parseFeedback = vi.fn(async () => makeParsed());
    const createTasksFromActionItems = vi.fn(async () => []);

    const handler = createParseFeedbackHandler({
      getFeedbackById,
      getProject,
      parseFeedback,
      createTasksFromActionItems,
    });

    await handler(makeJobData());

    expect(getFeedbackById).toHaveBeenCalledWith("feedback-1", "tenant-1");
    expect(parseFeedback).toHaveBeenCalledTimes(1);
    expect(createTasksFromActionItems).toHaveBeenCalledWith({
      projectId: "project-1",
      tenantId: "tenant-1",
      actionItems: makeParsed().actionItems,
      autoAssign: true,
    });
  });

  it("skips task creation when AI returns no action items", async () => {
    const createTasksFromActionItems = vi.fn(async () => []);
    const handler = createParseFeedbackHandler({
      getFeedbackById: vi.fn(async () => makeFeedback()),
      getProject: vi.fn(async () => ({ id: "project-1", name: "Project", description: "Brief" })),
      parseFeedback: vi.fn(async () => makeParsed({ actionItems: [] })),
      createTasksFromActionItems,
    });

    await handler(makeJobData());

    expect(createTasksFromActionItems).not.toHaveBeenCalled();
  });

  it("throws when feedback ids list is empty", async () => {
    const handler = createParseFeedbackHandler({
      getFeedbackById: vi.fn(async () => makeFeedback()),
      getProject: vi.fn(async () => ({ id: "project-1", name: "Project", description: "Brief" })),
      parseFeedback: vi.fn(async () => makeParsed()),
      createTasksFromActionItems: vi.fn(async () => []),
    });

    await expect(handler(makeJobData({ feedbackIds: [] }))).rejects.toThrow("feedbackIds is required");
  });

  it("rethrows feedback load errors", async () => {
    const handler = createParseFeedbackHandler({
      getFeedbackById: vi.fn(async () => {
        throw new Error("Feedback not found");
      }),
      getProject: vi.fn(async () => ({ id: "project-1", name: "Project", description: "Brief" })),
      parseFeedback: vi.fn(async () => makeParsed()),
      createTasksFromActionItems: vi.fn(async () => []),
    });

    await expect(handler(makeJobData())).rejects.toThrow("Feedback not found");
  });

  it("throws when project is missing", async () => {
    const parseFeedback = vi.fn(async () => makeParsed());
    const handler = createParseFeedbackHandler({
      getFeedbackById: vi.fn(async () => makeFeedback()),
      getProject: vi.fn(async () => null),
      parseFeedback,
      createTasksFromActionItems: vi.fn(async () => []),
    });

    await expect(handler(makeJobData())).rejects.toThrow("Project not found");
    expect(parseFeedback).not.toHaveBeenCalled();
  });

  it("builds AI input with project context and feedback fields", async () => {
    const parseFeedback = vi.fn(async (_input: ParseFeedbackInput) => makeParsed());
    const feedback = makeFeedback({ timecodeSec: null, category: null, author: { name: "QA", email: "qa@test.com" } });
    const handler = createParseFeedbackHandler({
      getFeedbackById: vi.fn(async () => feedback),
      getProject: vi.fn(async () => ({ id: "project-1", name: "Project X", description: null })),
      parseFeedback,
      createTasksFromActionItems: vi.fn(async () => []),
    });

    await handler(makeJobData());

    expect(parseFeedback).toHaveBeenCalledWith({
      feedbackItems: [
        {
          id: "feedback-1",
          text: "Fix logo on intro",
          timecodeSec: undefined,
          category: undefined,
          authorName: "QA",
        },
      ],
      projectContext: {
        name: "Project X",
        brief: undefined,
      },
    });
  });

  it("passes through multiple feedback ids", async () => {
    const getFeedbackById = vi
      .fn()
      .mockResolvedValueOnce(makeFeedback({ id: "f-1", text: "First" }))
      .mockResolvedValueOnce(makeFeedback({ id: "f-2", text: "Second" }));

    const handler = createParseFeedbackHandler({
      getFeedbackById,
      getProject: vi.fn(async () => ({ id: "project-1", name: "Project", description: "Brief" })),
      parseFeedback: vi.fn(async () => makeParsed({ totalFeedbackProcessed: 2 })),
      createTasksFromActionItems: vi.fn(async () => []),
    });

    await handler(makeJobData({ feedbackIds: ["f-1", "f-2"] }));

    expect(getFeedbackById).toHaveBeenCalledTimes(2);
    expect(getFeedbackById).toHaveBeenNthCalledWith(1, "f-1", "tenant-1");
    expect(getFeedbackById).toHaveBeenNthCalledWith(2, "f-2", "tenant-1");
  });

  it("logs start and completion", async () => {
    const logInfo = vi.fn();
    const handler = createParseFeedbackHandler({
      getFeedbackById: vi.fn(async () => makeFeedback()),
      getProject: vi.fn(async () => ({ id: "project-1", name: "Project", description: "Brief" })),
      parseFeedback: vi.fn(async () => makeParsed()),
      createTasksFromActionItems: vi.fn(async () => []),
      logInfo,
    });

    await handler(makeJobData());

    expect(logInfo).toHaveBeenCalledWith("[Parse Feedback Job] Starting for project project-1");
    expect(logInfo).toHaveBeenCalledWith("[Parse Feedback Job] Completed successfully");
  });

  it("logs and rethrows errors from AI parser", async () => {
    const logError = vi.fn();
    const handler = createParseFeedbackHandler({
      getFeedbackById: vi.fn(async () => makeFeedback()),
      getProject: vi.fn(async () => ({ id: "project-1", name: "Project", description: "Brief" })),
      parseFeedback: vi.fn(async () => {
        throw new Error("AI failed");
      }),
      createTasksFromActionItems: vi.fn(async () => []),
      logError,
    });

    await expect(handler(makeJobData())).rejects.toThrow("AI failed");
    expect(logError).toHaveBeenCalledWith("[Parse Feedback Job] Failed", expect.any(Error));
  });

  it("propagates task creation errors", async () => {
    const handler = createParseFeedbackHandler({
      getFeedbackById: vi.fn(async () => makeFeedback()),
      getProject: vi.fn(async () => ({ id: "project-1", name: "Project", description: "Brief" })),
      parseFeedback: vi.fn(async () => makeParsed()),
      createTasksFromActionItems: vi.fn(async () => {
        throw new Error("Task create failed");
      }),
    });

    await expect(handler(makeJobData())).rejects.toThrow("Task create failed");
  });
});
