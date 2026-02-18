import { beforeEach, describe, expect, it, vi } from "vitest";
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

function mockJsonResponse(payload: unknown, usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify(payload),
        },
      },
    ],
    usage,
  };
}

describe("AIService - Enhanced Methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseFeedbackEnhanced", () => {
    it("should parse voice feedback with cleaned text", async () => {
      const createMock = vi.fn().mockResolvedValue(
        mockJsonResponse({
          cleanedText: "Логотип сделать синим",
          tasks: [
            {
              title: "Изменить цвет логотипа на синий",
              category: "DESIGN",
              priority: "MEDIUM",
              timecode: 15,
            },
          ],
          confidence: 0.92,
        }),
      );
      const aiService = buildServiceWithMockedOpenAI(createMock);

      const result = await aiService.parseFeedbackEnhanced({
        text: "ээ логотип типа синим сделать",
        isVoice: true,
        timecodeSec: 15,
      });

      expect(result.cleanedText).toBe("Логотип сделать синим");
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].category).toBe("DESIGN");
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it("should handle non-task comments", async () => {
      const createMock = vi.fn().mockResolvedValue(
        mockJsonResponse({
          cleanedText: "Мне нравится",
          tasks: [],
          confidence: 0.95,
        }),
      );
      const aiService = buildServiceWithMockedOpenAI(createMock);

      const result = await aiService.parseFeedbackEnhanced({
        text: "мне нравится",
        isVoice: false,
      });

      expect(result.tasks).toHaveLength(0);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it("should extract multiple tasks from one comment", async () => {
      const createMock = vi.fn().mockResolvedValue(
        mockJsonResponse({
          cleanedText: "Логотип синий, музыка громче",
          tasks: [
            { title: "Изменить логотип", category: "DESIGN", priority: "MEDIUM" },
            { title: "Увеличить музыку", category: "AUDIO", priority: "HIGH" },
          ],
          confidence: 0.88,
        }),
      );
      const aiService = buildServiceWithMockedOpenAI(createMock);

      const result = await aiService.parseFeedbackEnhanced({
        text: "Логотип синий, музыка громче",
        isVoice: true,
      });

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].category).toBe("DESIGN");
      expect(result.tasks[1].category).toBe("AUDIO");
    });

    it("should retry transient errors and succeed", async () => {
      const createMock = vi
        .fn()
        .mockRejectedValueOnce({ code: "ETIMEDOUT", message: "timeout" })
        .mockResolvedValueOnce(
          mockJsonResponse({
            cleanedText: "Логотип сделать синим",
            tasks: [{ title: "Изменить цвет логотипа", category: "DESIGN", priority: "MEDIUM" }],
            confidence: 0.9,
          }),
        );
      const aiService = buildServiceWithMockedOpenAI(createMock);

      const result = await aiService.parseFeedbackEnhanced({
        text: "логотип синим",
        isVoice: false,
      });

      expect(result.tasks).toHaveLength(1);
      expect(createMock).toHaveBeenCalledTimes(2);
    });

    it("should fail on invalid response format", async () => {
      const createMock = vi.fn().mockResolvedValue(mockJsonResponse({ foo: "bar" }));
      const aiService = buildServiceWithMockedOpenAI(createMock);

      await expect(
        aiService.parseFeedbackEnhanced({
          text: "test",
          isVoice: false,
        }),
      ).rejects.toThrow("Invalid response format");
    });
  });

  describe("categorizeComments", () => {
    it("should categorize and prioritize comments", async () => {
      const createMock = vi.fn().mockResolvedValue(
        mockJsonResponse({
          categories: {
            DESIGN: [{ id: "1", category: "DESIGN", priority: "MEDIUM", isDuplicate: false }],
            AUDIO: [{ id: "2", category: "AUDIO", priority: "HIGH", isDuplicate: false }],
          },
          summary: {
            totalComments: 2,
            uniqueComments: 2,
            byCategory: { DESIGN: 1, AUDIO: 1 },
            byPriority: { HIGH: 1, MEDIUM: 1, LOW: 0 },
          },
        }),
      );
      const aiService = buildServiceWithMockedOpenAI(createMock);

      const result = await aiService.categorizeComments([
        { id: "1", text: "Логотип синий" },
        { id: "2", text: "Музыка громче" },
      ]);

      expect(result.summary.totalComments).toBe(2);
      expect(result.categories.DESIGN).toHaveLength(1);
      expect(result.categories.AUDIO).toHaveLength(1);
    });

    it("should detect duplicate comments", async () => {
      const createMock = vi.fn().mockResolvedValue(
        mockJsonResponse({
          categories: {
            DESIGN: [
              { id: "1", category: "DESIGN", priority: "MEDIUM", isDuplicate: false },
              {
                id: "3",
                category: "DESIGN",
                priority: "MEDIUM",
                isDuplicate: true,
                duplicateOf: "1",
                similarityScore: 0.95,
              },
            ],
          },
          summary: {
            totalComments: 2,
            uniqueComments: 1,
            byCategory: { DESIGN: 2 },
            byPriority: { HIGH: 0, MEDIUM: 2, LOW: 0 },
          },
        }),
      );
      const aiService = buildServiceWithMockedOpenAI(createMock);

      const result = await aiService.categorizeComments([
        { id: "1", text: "Логотип синий" },
        { id: "3", text: "Логотип изменить на синий цвет" },
      ]);

      expect(result.summary.uniqueComments).toBe(1);
      const duplicates = result.categories.DESIGN.filter((comment) => comment.isDuplicate);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].duplicateOf).toBe("1");
    });

    it("should handle empty array", async () => {
      const createMock = vi.fn();
      const aiService = buildServiceWithMockedOpenAI(createMock);
      const result = await aiService.categorizeComments([]);

      expect(result.summary.totalComments).toBe(0);
      expect(Object.keys(result.categories)).toHaveLength(0);
      expect(createMock).not.toHaveBeenCalled();
    });

    it("should batch requests with more than 50 comments and merge results", async () => {
      const createMock = vi
        .fn()
        .mockResolvedValueOnce(
          mockJsonResponse({
            categories: {
              DESIGN: [{ id: "1", category: "DESIGN", priority: "MEDIUM", isDuplicate: false }],
            },
            summary: {
              totalComments: 50,
              uniqueComments: 50,
              byCategory: { DESIGN: 1 },
              byPriority: { HIGH: 0, MEDIUM: 1, LOW: 0 },
            },
          }),
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            categories: {
              AUDIO: [{ id: "51", category: "AUDIO", priority: "HIGH", isDuplicate: false }],
            },
            summary: {
              totalComments: 1,
              uniqueComments: 1,
              byCategory: { AUDIO: 1 },
              byPriority: { HIGH: 1, MEDIUM: 0, LOW: 0 },
            },
          }),
        );
      const aiService = buildServiceWithMockedOpenAI(createMock);

      const comments = Array.from({ length: 51 }, (_, index) => ({
        id: String(index + 1),
        text: `Comment ${index + 1}`,
      }));

      const result = await aiService.categorizeComments(comments);

      expect(createMock).toHaveBeenCalledTimes(2);
      expect(result.summary.totalComments).toBe(51);
      expect(result.categories.DESIGN).toHaveLength(1);
      expect(result.categories.AUDIO).toHaveLength(1);
    });

    it("should retry transient OpenAI errors", async () => {
      const createMock = vi
        .fn()
        .mockRejectedValueOnce({ code: "ECONNRESET", message: "socket hang up" })
        .mockResolvedValueOnce(
          mockJsonResponse({
            categories: {
              OTHER: [{ id: "1", category: "OTHER", priority: "LOW", isDuplicate: false }],
            },
            summary: {
              totalComments: 1,
              uniqueComments: 1,
              byCategory: { OTHER: 1 },
              byPriority: { HIGH: 0, MEDIUM: 0, LOW: 1 },
            },
          }),
        );
      const aiService = buildServiceWithMockedOpenAI(createMock);

      const result = await aiService.categorizeComments([{ id: "1", text: "ok" }]);
      expect(result.summary.totalComments).toBe(1);
      expect(createMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("analyzeWithBrief", () => {
    const projectBrief = `
      Создать 2-минутное product demo video.
      Показать основные фичи, базовые эффекты, логотип.
      НЕ включено: 3D анимация, актёры, озвучка.
    `;

    it("should detect out-of-scope requests", async () => {
      const createMock = vi.fn().mockResolvedValue(
        mockJsonResponse({
          inScope: false,
          confidence: 0.87,
          reasoning: "3D анимация явно исключена из брифа",
          recommendation: "DECLINE",
          estimatedExtraHours: 10,
          suggestedResponse: "Спасибо за предложение! 3D анимация не входит в scope.",
        }),
      );
      const aiService = buildServiceWithMockedOpenAI(createMock);

      const result = await aiService.analyzeWithBrief({
        commentText: "Добавить 3D анимацию логотипа",
        projectBrief,
      });

      expect(result.inScope).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.recommendation).toBe("DECLINE");
      expect(result.estimatedExtraHours).toBeGreaterThan(0);
    });

    it("should detect in-scope requests", async () => {
      const createMock = vi.fn().mockResolvedValue(
        mockJsonResponse({
          inScope: true,
          confidence: 0.95,
          reasoning: "Изменение цвета логотипа входит в базовые эффекты",
          recommendation: "APPROVE",
        }),
      );
      const aiService = buildServiceWithMockedOpenAI(createMock);

      const result = await aiService.analyzeWithBrief({
        commentText: "Логотип сделать синим",
        projectBrief,
      });

      expect(result.inScope).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.recommendation).toBe("APPROVE");
    });

    it("should request info for unclear cases", async () => {
      const createMock = vi.fn().mockResolvedValue(
        mockJsonResponse({
          inScope: true,
          confidence: 0.55,
          reasoning: 'Непонятно что значит "более динамичное"',
          recommendation: "REQUEST_INFO",
        }),
      );
      const aiService = buildServiceWithMockedOpenAI(createMock);

      const result = await aiService.analyzeWithBrief({
        commentText: "Сделать видео более динамичным",
        projectBrief,
      });

      expect(result.recommendation).toBe("REQUEST_INFO");
      expect(result.confidence).toBeLessThan(0.7);
    });

    it("should handle empty brief", async () => {
      const aiService = new AIService();

      await expect(
        aiService.analyzeWithBrief({
          commentText: "test",
          projectBrief: "",
        }),
      ).rejects.toThrow(/brief/i);
    });

    it("should fail on invalid response shape", async () => {
      const createMock = vi.fn().mockResolvedValue(mockJsonResponse({ foo: "bar" }));
      const aiService = buildServiceWithMockedOpenAI(createMock);

      await expect(
        aiService.analyzeWithBrief({
          commentText: "test",
          projectBrief,
        }),
      ).rejects.toThrow("Invalid response format");
    });
  });
});
