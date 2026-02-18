import { describe, expect, it, vi } from "vitest";
import { AIService } from "@/lib/services/ai.service";

type MockCreate = ReturnType<typeof vi.fn>;

function buildServiceWithMockedOpenAI(createImpl: MockCreate): AIService {
  const service = new AIService();
  ((service as unknown) as { openai: unknown }).openai = {
    chat: {
      completions: {
        create: createImpl,
      },
    },
  };
  return service;
}

function mockJsonResponse(payload: unknown) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify(payload),
        },
      },
    ],
  };
}

describe("AIService.parseFeedback", () => {
  it("should parse feedback and extract action items", async () => {
    const createMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        summary: "Client requested visual and audio fixes.",
        dedupedCount: 1,
        actionItems: [
          {
            text: "Change logo at 0:15",
            priority: "HIGH",
            category: "DESIGN",
            estimatedMinutes: 20,
            sourceFeedbackIds: ["fb-1"],
          },
        ],
      }),
    );
    const aiService = buildServiceWithMockedOpenAI(createMock);

    const result = await aiService.parseFeedback({
      feedbackItems: [
        { id: "fb-1", text: "Change logo at 0:15", timecodeSec: 15, authorName: "Client" },
        { id: "fb-2", text: "Overall great work", authorName: "Client" },
      ],
      projectContext: { name: "Brand Video", brief: "Promo spot" },
    });

    expect(result.summary).toContain("Client requested");
    expect(result.totalFeedbackProcessed).toBe(2);
    expect(result.dedupedCount).toBe(1);
    expect(result.actionItems.length).toBe(1);
    expect(result.actionItems[0].priority).toBe("HIGH");
    expect(result.actionItems[0].category).toBe("DESIGN");
    expect(result.actionItems[0].sourceFeedbackIds).toEqual(["fb-1"]);
  });

  it("should fail if feedbackItems is empty", async () => {
    const aiService = new AIService();
    await expect(aiService.parseFeedback({ feedbackItems: [] })).rejects.toThrow("Feedback items are required");
  });

  it("should fail if feedback item text is empty", async () => {
    const aiService = new AIService();
    await expect(
      aiService.parseFeedback({
        feedbackItems: [{ id: "fb-1", text: "   ", authorName: "Client" }],
      }),
    ).rejects.toThrow("must have id and text");
  });

  it("should map unknown priority/category to defaults", async () => {
    const createMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        summary: "Summary",
        actionItems: [
          {
            text: "Fix typo",
            priority: "SEVERE",
            category: "TYPO",
            sourceFeedbackIds: ["fb-1", "", 100],
          },
        ],
      }),
    );
    const aiService = buildServiceWithMockedOpenAI(createMock);

    const result = await aiService.parseFeedback({
      feedbackItems: [{ id: "fb-1", text: "Fix typo", authorName: "Client" }],
    });

    expect(result.actionItems[0].priority).toBe("MEDIUM");
    expect(result.actionItems[0].category).toBe("OTHER");
    expect(result.actionItems[0].sourceFeedbackIds).toEqual(["fb-1"]);
  });

  it("should fail on invalid JSON response", async () => {
    const createMock = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "{invalid" } }],
    });
    const aiService = buildServiceWithMockedOpenAI(createMock);

    await expect(
      aiService.parseFeedback({
        feedbackItems: [{ id: "fb-1", text: "Change logo", authorName: "Client" }],
      }),
    ).rejects.toThrow("Invalid JSON response from OpenAI");
  });

  it("should map quota errors", async () => {
    const createMock = vi.fn().mockRejectedValue({ code: "insufficient_quota", message: "quota reached" });
    const aiService = buildServiceWithMockedOpenAI(createMock);

    await expect(
      aiService.parseFeedback({
        feedbackItems: [{ id: "fb-1", text: "Change logo", authorName: "Client" }],
      }),
    ).rejects.toThrow("OpenAI API quota exceeded");
  });

  it("should map network errors", async () => {
    const createMock = vi.fn().mockRejectedValue({ code: "ENOTFOUND", message: "dns fail" });
    const aiService = buildServiceWithMockedOpenAI(createMock);

    await expect(
      aiService.parseFeedback({
        feedbackItems: [{ id: "fb-1", text: "Change logo", authorName: "Client" }],
      }),
    ).rejects.toThrow("OpenAI network error");
  });
});

describe("AIService.extractActionItems", () => {
  it("should extract action items from text", async () => {
    const createMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        actionItems: [
          { text: "Use upbeat music", priority: "HIGH", category: "SOUND", sourceFeedbackIds: ["line-1"] },
          { text: "Fix typo in credits", priority: "MEDIUM", category: "CONTENT" },
        ],
      }),
    );
    const aiService = buildServiceWithMockedOpenAI(createMock);

    const result = await aiService.extractActionItems("Change music and fix typo.");

    expect(result.length).toBe(2);
    expect(result[0].category).toBe("SOUND");
    expect(result[1].priority).toBe("MEDIUM");
  });

  it("should fail when feedback text is empty", async () => {
    const aiService = new AIService();
    await expect(aiService.extractActionItems("   ")).rejects.toThrow("Feedback text is required");
  });
});

describe("AIService.generateClientUpdate", () => {
  it("should generate professional update", async () => {
    const createMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        subject: "Update: Corporate Video",
        body: "Hello, we completed requested design and audio updates for Corporate Video.",
        tone: "professional",
      }),
    );
    const aiService = buildServiceWithMockedOpenAI(createMock);

    const result = await aiService.generateClientUpdate({
      projectName: "Corporate Video",
      completedTasks: [
        { title: "Changed logo color", category: "DESIGN" },
        { title: "Fixed audio levels", category: "SOUND" },
      ],
      nextSteps: "Awaiting final approval",
    });

    expect(result.subject).toContain("Corporate Video");
    expect(result.body).toContain("Corporate Video");
    expect(result.tone).toBe("professional");
  });

  it("should fail if project name or completed tasks missing", async () => {
    const aiService = new AIService();
    await expect(
      aiService.generateClientUpdate({
        projectName: "",
        completedTasks: [],
      }),
    ).rejects.toThrow("Project name and completed tasks are required");
  });

  it("should map invalid API key errors", async () => {
    const createMock = vi.fn().mockRejectedValue({ code: "invalid_api_key", message: "bad key" });
    const aiService = buildServiceWithMockedOpenAI(createMock);

    await expect(
      aiService.generateClientUpdate({
        projectName: "Corporate Video",
        completedTasks: [{ title: "Task", category: "DESIGN" }],
      }),
    ).rejects.toThrow("Invalid OpenAI API key");
  });
});

describe("AIService.analyzeScopeCompliance", () => {
  it("should analyze scope and return normalized data", async () => {
    const createMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        label: "OUT_OF_SCOPE",
        confidence: 0.87,
        reasoning: "Animated intro is not part of the brief.",
        suggestedAction: "Approve a change request.",
        estimatedCost: 800,
      }),
    );
    const aiService = buildServiceWithMockedOpenAI(createMock);

    const result = await aiService.analyzeScopeCompliance({
      feedbackText: "Add a new 30-second animated intro sequence",
      feedbackId: "fb-scope-1",
      projectScope: "Create a 2-minute product demo video.",
      projectName: "Product Demo",
    });

    expect(result.label).toBe("OUT_OF_SCOPE");
    expect(result.confidence).toBe(0.87);
    expect(result.reasoning).toContain("Animated intro");
    expect(result.estimatedCost).toBe(800);
  });

  it("should fallback to UNCLEAR when model returns invalid label", async () => {
    const createMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        label: "MAYBE",
        confidence: 0.9,
        reasoning: "Unrecognized label",
        suggestedAction: "Review manually",
      }),
    );
    const aiService = buildServiceWithMockedOpenAI(createMock);

    const result = await aiService.analyzeScopeCompliance({
      feedbackText: "Need something",
      feedbackId: "fb-scope-2",
      projectScope: "Create product demo.",
      projectName: "Demo",
    });

    expect(result.label).toBe("UNCLEAR");
  });

  it("should clamp confidence into 0..1 range", async () => {
    const createMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        label: "IN_SCOPE",
        confidence: 7,
        reasoning: "Looks in scope",
        suggestedAction: "Proceed",
      }),
    );
    const aiService = buildServiceWithMockedOpenAI(createMock);

    const result = await aiService.analyzeScopeCompliance({
      feedbackText: "Increase logo size",
      feedbackId: "fb-scope-3",
      projectScope: "Create a demo video with logo overlays.",
      projectName: "Brand Video",
    });

    expect(result.confidence).toBe(1);
  });

  it("should fail if project scope is empty", async () => {
    const aiService = new AIService();

    await expect(
      aiService.analyzeScopeCompliance({
        feedbackText: "Change logo",
        feedbackId: "fb-empty-scope",
        projectScope: "   ",
        projectName: "Demo",
      }),
    ).rejects.toThrow("empty");
  });

  it("should map quota errors", async () => {
    const createMock = vi.fn().mockRejectedValue({ code: "insufficient_quota", message: "quota reached" });
    const aiService = buildServiceWithMockedOpenAI(createMock);

    await expect(
      aiService.analyzeScopeCompliance({
        feedbackText: "Change logo",
        feedbackId: "fb-scope-4",
        projectScope: "Create a demo video.",
        projectName: "Demo",
      }),
    ).rejects.toThrow("OpenAI API quota exceeded");
  });
});

describe("AIService.generateChangeRequestTemplate", () => {
  it("should generate a change request template", async () => {
    const createMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        subject: "Change Request: Corporate Video",
        body: "Thanks for the request for Corporate Video.",
        estimatedCost: 800,
        estimatedDays: 4,
      }),
    );
    const aiService = buildServiceWithMockedOpenAI(createMock);

    const result = await aiService.generateChangeRequestTemplate("Add animated intro", 800, "Corporate Video");

    expect(result.subject).toContain("Corporate Video");
    expect(result.body).toContain("Corporate Video");
    expect(result.estimatedCost).toBe(800);
    expect(result.estimatedDays).toBe(4);
  });

  it("should fail if required input is missing", async () => {
    const aiService = new AIService();
    await expect(aiService.generateChangeRequestTemplate("", 500, "")).rejects.toThrow(
      "Feedback text and project name are required",
    );
  });
});

describe("AIService integration (requires OPENAI_API_KEY)", () => {
  const itIfOpenAI = process.env.OPENAI_API_KEY?.trim() ? it : it.skip;

  itIfOpenAI("should parse feedback with real OpenAI", async () => {
    const aiService = new AIService();
    const result = await aiService.parseFeedback(
      {
        feedbackItems: [
          { id: "fb-1", text: "Change logo color at 0:10", timecodeSec: 10, authorName: "Client" },
          { id: "fb-2", text: "Increase text size at 1:05", timecodeSec: 65, authorName: "Client" },
          { id: "fb-3", text: "Looks great overall", authorName: "Client" },
        ],
        projectContext: {
          name: "Launch Video",
          brief: "90-second product launch video",
        },
      },
    );

    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.totalFeedbackProcessed).toBe(3);
    expect(Array.isArray(result.actionItems)).toBe(true);
  }, 30000);

  itIfOpenAI("should generate client update with real OpenAI", async () => {
    const aiService = new AIService();
    const result = await aiService.generateClientUpdate({
      projectName: "Launch Video",
      completedTasks: [
        { title: "Changed intro logo color", category: "DESIGN" },
        { title: "Balanced background audio", category: "SOUND" },
      ],
      nextSteps: "Preparing final export and awaiting your approval.",
    });

    expect(result.subject.length).toBeGreaterThan(0);
    expect(result.body.length).toBeGreaterThan(0);
  }, 30000);

  itIfOpenAI("should analyze scope with real OpenAI", async () => {
    const aiService = new AIService();
    const result = await aiService.analyzeScopeCompliance({
      feedbackText: "Can you make the logo a bit bigger?",
      feedbackId: "fb-openai-scope-1",
      projectScope: "Create 2-minute product demo video with logo and text overlays",
      projectName: "Product Demo",
    });

    expect(["IN_SCOPE", "OUT_OF_SCOPE", "UNCLEAR"]).toContain(result.label);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  }, 30000);

  itIfOpenAI("should generate change request template with real OpenAI", async () => {
    const aiService = new AIService();
    const result = await aiService.generateChangeRequestTemplate("Add animated intro", 800, "Corporate Video");

    expect(result.subject.length).toBeGreaterThan(0);
    expect(result.body.length).toBeGreaterThan(0);
    expect(result.estimatedCost).toBe(800);
    expect(result.estimatedDays).toBeGreaterThan(0);
  }, 30000);
});
