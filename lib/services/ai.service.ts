import OpenAI from "openai";
import type {
  ActionItem,
  AnalyzeScopeInput,
  ChangeRequestTemplate,
  ClientUpdateResult,
  FeedbackCategory,
  GenerateClientUpdateInput,
  ParseFeedbackInput,
  ParsedFeedbackResult,
  ScopeAnalysisResult,
  ScopeLabel,
  TaskPriority,
} from "@/types";
import type {
  AnalyzeWithBriefInput,
  AnalyzeWithBriefResult,
  CategorizedComment,
  CategorizeCommentsInput,
  CategorizeCommentsResult,
  ExtractedTask,
  ParseFeedbackEnhancedInput,
  ParseFeedbackEnhancedResult,
} from "@/lib/types/ai";

type JsonRecord = Record<string, unknown>;
type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedUsd: number;
};

export class AIService {
  private openai: OpenAI | null = null;
  private tokenUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedUsd: 0,
  };

  async parseFeedback(input: ParseFeedbackInput): Promise<ParsedFeedbackResult> {
    const { feedbackItems, projectContext } = input;

    if (!Array.isArray(feedbackItems) || feedbackItems.length === 0) {
      throw new Error("Feedback items are required");
    }

    for (const item of feedbackItems) {
      if (!item?.id || typeof item.id !== "string" || !item.text || !item.text.trim()) {
        throw new Error("Each feedback item must have id and text");
      }
    }

    const systemPrompt = this.buildParseFeedbackSystemPrompt();
    const userPrompt = this.buildParseFeedbackUserPrompt(feedbackItems, projectContext);

    try {
      const content = await this.createJsonCompletion(systemPrompt, userPrompt, 0.3);
      const parsed = this.parseJsonObject(content);

      return {
        summary: this.getString(parsed.summary) ?? "No summary provided",
        actionItems: this.validateActionItems(parsed.actionItems),
        dedupedCount: this.getNonNegativeInt(parsed.dedupedCount) ?? 0,
        totalFeedbackProcessed: feedbackItems.length,
      };
    } catch (error) {
      throw this.normalizeOpenAIError("AI parsing failed", error);
    }
  }

  async extractActionItems(feedbackText: string): Promise<ActionItem[]> {
    if (!feedbackText || !feedbackText.trim()) {
      throw new Error("Feedback text is required");
    }

    const systemPrompt = `Extract actionable tasks from the feedback text for a video editing team.
Return JSON only.
Output schema:
{
  "actionItems": [
    {
      "text": "Action item",
      "priority": "LOW|MEDIUM|HIGH|URGENT",
      "category": "CONTENT|DESIGN|SOUND|LEGAL|OTHER",
      "estimatedMinutes": 15
    }
  ]
}`;
    const userPrompt = `Feedback:\n${feedbackText}\n\nExtract action items.`;

    try {
      const content = await this.createJsonCompletion(systemPrompt, userPrompt, 0.3);
      const parsed = this.parseJsonObject(content);
      const payload = Array.isArray(parsed) ? parsed : parsed.actionItems;
      return this.validateActionItems(payload);
    } catch (error) {
      throw this.normalizeOpenAIError("Action item extraction failed", error);
    }
  }

  async generateClientUpdate(input: GenerateClientUpdateInput): Promise<ClientUpdateResult> {
    const { projectName, completedTasks, nextSteps } = input;

    if (!projectName || !projectName.trim() || !Array.isArray(completedTasks) || completedTasks.length === 0) {
      throw new Error("Project name and completed tasks are required");
    }

    const systemPrompt = `You are writing a professional email to a client about their video project.
Be concise, friendly, and positive. Highlight completed work and set clear expectations.

Return JSON:
{
  "subject": "Short email subject line (under 60 chars)",
  "body": "Email body with greeting, completed tasks summary, and next steps. Use markdown formatting.",
  "tone": "professional"
}`;

    const completedTaskLines = completedTasks.map((task) => `- ${task.title} (${task.category})`).join("\n");
    const userPrompt = `Project: ${projectName}

Completed tasks:
${completedTaskLines}

${nextSteps ? `Next steps: ${nextSteps}` : "Awaiting client feedback."}

Write a client update email.`;

    try {
      const content = await this.createJsonCompletion(systemPrompt, userPrompt, 0.5);
      const parsed = this.parseJsonObject(content);

      return {
        subject: this.getString(parsed.subject) ?? `Update on ${projectName}`,
        body: this.getString(parsed.body) ?? "No update available.",
        tone: this.validateTone(parsed.tone),
      };
    } catch (error) {
      throw this.normalizeOpenAIError("Client update generation failed", error);
    }
  }

  async analyzeScopeCompliance(input: AnalyzeScopeInput): Promise<ScopeAnalysisResult> {
    const { feedbackText, feedbackId, projectScope, projectName } = input;

    if (!feedbackText || !projectScope) {
      throw new Error("Feedback text and project scope are required");
    }

    if (!projectScope.trim()) {
      throw new Error("Project scope/brief is empty. Cannot analyze without original scope.");
    }

    const systemPrompt = `You are an AI assistant for a video production agency.
Your task is to analyze client feedback and determine if it's within the original project scope.

Guidelines:
- Compare the feedback request with the original project brief/SOW
- Consider these factors:
  * Is this a NEW feature/deliverable not mentioned in the original scope?
  * Is this a refinement/polish of EXISTING agreed work?
  * Is the magnitude of work reasonable for the original quote?
  * Is the request vague and needs clarification?

- Assign label:
  * IN_SCOPE: Request is clearly within the original agreement
  * OUT_OF_SCOPE: Request is a new deliverable or major change
  * UNCLEAR: Request needs clarification from client

- Provide confidence score (0.0 - 1.0):
  * 0.9-1.0: Very confident
  * 0.7-0.9: Confident
  * 0.5-0.7: Somewhat confident
  * <0.5: Low confidence, needs PM review

- Explain reasoning clearly (2-3 sentences)
- Suggest specific action for PM
- If out-of-scope, estimate additional cost in USD (be conservative, typical range: $200-$2000)

Return JSON:
{
  "label": "IN_SCOPE|OUT_OF_SCOPE|UNCLEAR",
  "confidence": 0.85,
  "reasoning": "Detailed explanation",
  "suggestedAction": "What PM should do",
  "estimatedCost": 500
}`;

    const userPrompt = `Project: ${projectName}

Original Scope/Brief:
${projectScope}

New Client Feedback (ID: ${feedbackId}):
${feedbackText}

Analyze: Is this request in-scope or out-of-scope?`;

    try {
      const content = await this.createJsonCompletion(systemPrompt, userPrompt, 0.2);
      const parsed = this.parseJsonObject(content);

      const validLabels: ScopeLabel[] = ["IN_SCOPE", "OUT_OF_SCOPE", "UNCLEAR"];
      const rawLabel = this.getString(parsed.label);
      const label = validLabels.includes(rawLabel as ScopeLabel) ? (rawLabel as ScopeLabel) : "UNCLEAR";
      const confidence = Math.max(0, Math.min(1, this.getNumber(parsed.confidence) ?? 0.5));
      const estimatedCost = this.getNumber(parsed.estimatedCost);

      return {
        label,
        confidence,
        reasoning: this.getString(parsed.reasoning) ?? "No reasoning provided",
        suggestedAction: this.getString(parsed.suggestedAction) ?? "Review manually with PM",
        estimatedCost: estimatedCost && estimatedCost > 0 ? estimatedCost : undefined,
      };
    } catch (error) {
      throw this.normalizeOpenAIError("Scope analysis failed", error);
    }
  }

  async generateChangeRequestTemplate(
    feedbackText: string,
    estimatedCost: number,
    projectName: string,
  ): Promise<ChangeRequestTemplate> {
    if (!feedbackText || !projectName) {
      throw new Error("Feedback text and project name are required");
    }

    const systemPrompt = `You are writing a professional change request email for a video production client.
The client's request is out of the original project scope.

Tone: Professional, friendly, solution-oriented
Goal: Explain the situation clearly and offer a path forward

Return JSON:
{
  "subject": "Short email subject line (under 60 chars)",
  "body": "Professional email body explaining:
    1. Acknowledge their request
    2. Explain it's beyond original scope
    3. Provide cost estimate and timeline
    4. Offer next steps
    Use markdown formatting for readability.",
  "estimatedCost": ${estimatedCost},
  "estimatedDays": 3
}`;

    const userPrompt = `Project: ${projectName}
Client Request: ${feedbackText}
Estimated Additional Cost: $${estimatedCost}

Generate a change request email.`;

    try {
      const content = await this.createJsonCompletion(systemPrompt, userPrompt, 0.4);
      const parsed = this.parseJsonObject(content);

      return {
        subject: this.getString(parsed.subject) ?? `Change Request: ${projectName}`,
        body: this.getString(parsed.body) ?? "Template generation failed",
        estimatedCost: this.getNumber(parsed.estimatedCost) ?? estimatedCost,
        estimatedDays: Math.max(1, this.getNonNegativeInt(parsed.estimatedDays) ?? 3),
      };
    } catch (error) {
      throw this.normalizeOpenAIError("Template generation failed", error);
    }
  }

  async transcribeAudioFeedback(input?: unknown): Promise<{ text: string }> {
    const audioFile = this.extractAudioFile(input);
    if (!audioFile) {
      throw new Error("Audio file is required");
    }

    try {
      const transcription = await this.getClient().audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
      });

      const text = this.getString((transcription as { text?: unknown }).text)?.trim();
      if (!text) {
        throw new Error("Transcription API unavailable");
      }

      return { text };
    } catch (error) {
      throw this.normalizeOpenAIError("Audio transcription failed", error);
    }
  }

  async categorizeFeedback(_input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }

  async estimateTaskPriority(_input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }

  async dedupeActionItems(_input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }

  async parseFeedbackEnhanced(input: ParseFeedbackEnhancedInput): Promise<ParseFeedbackEnhancedResult> {
    const { text, isVoice, timecodeSec, videoContext } = input;
    if (!text || !text.trim()) {
      throw new Error("Feedback text is required");
    }

    const systemPrompt = `Ты — ассистент для видеопродакшна. Анализируешь feedback от клиентов.

${isVoice ? "ВАЖНО: Это голосовой ввод (speech-to-text), могут быть опечатки, разговорный стиль и междометия." : ""}

Твоя задача:
1. Очистить текст -> cleanedText
2. Извлечь actionable задачи -> tasks[]
3. Для каждой задачи определить title, category (DESIGN/AUDIO/CONTENT/TECHNICAL/OTHER), priority (HIGH/MEDIUM/LOW)
4. Вернуть confidence (0-1)

Если это не задача, tasks должен быть пустым массивом.

Верни только JSON:
{
  "cleanedText": "string",
  "tasks": [
    {
      "title": "string",
      "category": "DESIGN|AUDIO|CONTENT|TECHNICAL|OTHER",
      "priority": "HIGH|MEDIUM|LOW",
      "timecode": ${typeof timecodeSec === "number" ? timecodeSec : "null"},
      "details": "string"
    }
  ],
  "confidence": 0.0
}`;
    const userPrompt = `Feedback: "${text}"${videoContext ? `\nКонтекст видео: ${videoContext}` : ""}`;

    try {
      const content = await this.createJsonCompletion(systemPrompt, userPrompt, 0.3, 1000, 2);
      const parsed = this.parseJsonObject(content);

      const cleanedText = this.getString(parsed.cleanedText)?.trim();
      const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : null;
      if (!cleanedText || rawTasks === null) {
        throw new Error("Invalid response format");
      }

      const tasks = rawTasks
        .map((task) => this.validateExtractedTask(task, timecodeSec))
        .filter((task): task is ExtractedTask => task !== null);
      const confidence = this.clamp01(this.getNumber(parsed.confidence) ?? 0.5);

      return { cleanedText, tasks, confidence };
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid response format") {
        throw error;
      }
      throw this.normalizeOpenAIError("Enhanced feedback parsing failed", error);
    }
  }

  async categorizeComments(comments: CategorizeCommentsInput[]): Promise<CategorizeCommentsResult> {
    if (!Array.isArray(comments)) {
      throw new Error("Comments should be an array");
    }

    if (comments.length === 0) {
      return {
        categories: {},
        summary: {
          totalComments: 0,
          uniqueComments: 0,
          byCategory: {},
          byPriority: { HIGH: 0, MEDIUM: 0, LOW: 0 },
        },
      };
    }

    const batchSize = 50;
    const results: CategorizeCommentsResult[] = [];

    for (let i = 0; i < comments.length; i += batchSize) {
      const batch = comments.slice(i, i + batchSize);
      const systemPrompt = `Ты — ассистент для категоризации feedback.

Задачи:
1. Для каждого комментария определить category (DESIGN/AUDIO/CONTENT/TECHNICAL/OTHER) и priority (HIGH/MEDIUM/LOW).
2. Выявить дубликаты:
   - первый комментарий в группе считается оригиналом (isDuplicate=false)
   - похожие комментарии: isDuplicate=true, duplicateOf="id оригинала"
   - similarityScore от 0 до 1

Верни только JSON:
{
  "categories": {
    "DESIGN": [
      {
        "id": "1",
        "category": "DESIGN",
        "priority": "MEDIUM",
        "isDuplicate": false,
        "duplicateOf": "1",
        "similarityScore": 1
      }
    ]
  },
  "summary": {
    "totalComments": 2,
    "uniqueComments": 1,
    "byCategory": { "DESIGN": 2 },
    "byPriority": { "HIGH": 0, "MEDIUM": 2, "LOW": 0 }
  }
}`;
      const userPrompt = `Комментарии:\n${batch.map((comment) => `ID:${comment.id} | ${comment.text}`).join("\n")}`;

      try {
        const content = await this.createJsonCompletion(systemPrompt, userPrompt, 0.2, 2000, 2);
        const parsed = this.parseJsonObject(content);
        results.push(this.validateCategorizeResult(parsed, batch.length));
      } catch (error) {
        throw this.normalizeOpenAIError("Comment categorization failed", error);
      }
    }

    return this.mergeCategorizeResults(results);
  }

  async analyzeWithBrief(input: AnalyzeWithBriefInput): Promise<AnalyzeWithBriefResult> {
    const { commentText, projectBrief, existingTasks } = input;

    if (!commentText || !commentText.trim()) {
      throw new Error("Comment text is required");
    }
    if (!projectBrief || !projectBrief.trim()) {
      throw new Error("Project brief is required");
    }

    const systemPrompt = `Ты — PM ассистент для Scope Guard.
Определи, входит ли запрос клиента в scope проекта.

PROJECT BRIEF:
${projectBrief}

${existingTasks && existingTasks.length > 0 ? `Уже согласованные задачи:\n${existingTasks.map((task) => `- ${task}`).join("\n")}` : ""}

Анализируй и верни JSON:
{
  "inScope": true,
  "confidence": 0.0,
  "reasoning": "string",
  "recommendation": "APPROVE|DECLINE|REQUEST_INFO",
  "estimatedExtraHours": 10,
  "suggestedResponse": "string"
}`;
    const userPrompt = `Запрос клиента: "${commentText}"`;

    try {
      const content = await this.createJsonCompletion(systemPrompt, userPrompt, 0.3, 800, 2);
      const parsed = this.parseJsonObject(content);
      const inScope = typeof parsed.inScope === "boolean" ? parsed.inScope : null;
      const reasoning = this.getString(parsed.reasoning)?.trim();
      if (inScope === null || !reasoning) {
        throw new Error("Invalid response format");
      }

      const recommendation = this.validateRecommendation(parsed.recommendation);
      const estimatedExtraHours = this.getNonNegativeInt(parsed.estimatedExtraHours);
      const suggestedResponse = this.getString(parsed.suggestedResponse);

      return {
        inScope,
        confidence: this.clamp01(this.getNumber(parsed.confidence) ?? 0.5),
        reasoning,
        recommendation,
        estimatedExtraHours: inScope ? undefined : estimatedExtraHours,
        suggestedResponse,
      };
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid response format") {
        throw error;
      }
      throw this.normalizeOpenAIError("Scope analysis with brief failed", error);
    }
  }

  getTokenUsage(): TokenUsage {
    return { ...this.tokenUsage };
  }

  async healthCheck(_input?: unknown): Promise<unknown> {
    return { status: "ok" };
  }

  private getClient(): OpenAI {
    if (this.openai) {
      return this.openai;
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required");
    }

    this.openai = new OpenAI({ apiKey });
    return this.openai;
  }

  private async createJsonCompletion(
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    maxTokens = 1200,
    retries = 1,
  ): Promise<string> {
    let attempt = 0;
    const maxAttempts = Math.max(1, retries + 1);

    while (attempt < maxAttempts) {
      try {
        const response = await this.getClient().chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
        });
        this.trackTokenUsage(response.usage);

        const content = response.choices[0]?.message?.content;
        if (!content || typeof content !== "string") {
          throw new Error("Empty response from OpenAI");
        }

        return content;
      } catch (error) {
        attempt += 1;
        if (attempt >= maxAttempts || !this.isTransientOpenAIError(error)) {
          throw error;
        }
      }
    }

    throw new Error("OpenAI request failed after retries");
  }

  private buildParseFeedbackSystemPrompt(): string {
    return `You are an AI assistant for a video editing agency CRM.
Your task is to analyze client feedback and extract actionable tasks for video editors.

Guidelines:
- Identify specific, actionable requests
- Remove duplicate or similar feedback
- Assign priority based on urgency and impact
- Categorize by type (CONTENT, DESIGN, SOUND, LEGAL, OTHER)
- Preserve timecode references in the action text
- Ignore vague praise like "looks good" or "great work"
- Combine related feedback items when appropriate

Return a JSON object with:
{
  "summary": "Brief overview of all feedback in 1-2 sentences",
  "actionItems": [
    {
      "text": "Clear action description with timecode if applicable",
      "priority": "LOW|MEDIUM|HIGH|URGENT",
      "category": "CONTENT|DESIGN|SOUND|LEGAL|OTHER",
      "estimatedMinutes": 15,
      "sourceFeedbackIds": ["id1", "id2"]
    }
  ],
  "dedupedCount": 2
}`;
  }

  private buildParseFeedbackUserPrompt(
    feedbackItems: ParseFeedbackInput["feedbackItems"],
    projectContext?: ParseFeedbackInput["projectContext"],
  ): string {
    let prompt = "";

    if (projectContext) {
      prompt += `Project: ${projectContext.name}\n`;
      if (projectContext.brief) {
        prompt += `Brief: ${projectContext.brief}\n`;
      }
      prompt += "\n";
    }

    prompt += "Client Feedback:\n";
    for (const item of feedbackItems) {
      const safeAuthor = item.authorName?.trim() || "Client";
      const timecode = typeof item.timecodeSec === "number" ? ` at ${this.formatTimecode(item.timecodeSec)}` : "";
      prompt += `[${item.id}] ${safeAuthor}${timecode}: ${item.text}\n`;
    }

    prompt += "\nPlease analyze and extract actionable tasks.";
    return prompt;
  }

  private formatTimecode(seconds: number): string {
    const safeSeconds = Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : 0;
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  private parseJsonObject(content: string): JsonRecord {
    try {
      const parsed: unknown = JSON.parse(content);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid JSON response from OpenAI");
      }
      return parsed as JsonRecord;
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid JSON response from OpenAI") {
        throw error;
      }
      throw new Error("Invalid JSON response from OpenAI");
    }
  }

  private validateActionItems(items: unknown): ActionItem[] {
    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .filter((item): item is JsonRecord => !!item && typeof item === "object")
      .map((item): ActionItem | null => {
        const text = this.getString(item.text)?.trim();
        if (!text) {
          return null;
        }

        const sourceFeedbackIds = Array.isArray(item.sourceFeedbackIds)
          ? item.sourceFeedbackIds.filter((id): id is string => typeof id === "string" && !!id.trim())
          : [];

        return {
          text,
          priority: this.validatePriority(item.priority),
          category: this.validateCategory(item.category),
          suggestedAssignee: this.getString(item.suggestedAssignee),
          estimatedMinutes: this.getNonNegativeInt(item.estimatedMinutes),
          sourceFeedbackIds,
        };
      })
      .filter((item): item is ActionItem => item !== null);
  }

  private validatePriority(value: unknown): TaskPriority {
    const normalized = typeof value === "string" ? value.toUpperCase() : "";
    const valid: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
    return valid.includes(normalized as TaskPriority) ? (normalized as TaskPriority) : "MEDIUM";
  }

  private validateCategory(value: unknown): FeedbackCategory {
    const normalized = typeof value === "string" ? value.toUpperCase() : "";
    const valid: FeedbackCategory[] = ["CONTENT", "DESIGN", "SOUND", "LEGAL", "OTHER"];
    return valid.includes(normalized as FeedbackCategory) ? (normalized as FeedbackCategory) : "OTHER";
  }

  private validateTone(value: unknown): ClientUpdateResult["tone"] {
    const normalized = typeof value === "string" ? value.toLowerCase() : "";
    if (normalized === "friendly") {
      return "friendly";
    }
    if (normalized === "formal") {
      return "formal";
    }
    return "professional";
  }

  private getString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
  }

  private extractAudioFile(input?: unknown): File | null {
    if (!input || typeof input !== "object") {
      return null;
    }

    const candidate = (input as { audio?: unknown }).audio;
    if (!candidate || typeof File === "undefined") {
      return null;
    }

    return candidate instanceof File ? candidate : null;
  }

  private getNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }

  private getNonNegativeInt(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return Math.floor(value);
    }
    return undefined;
  }

  private validateExtractedTask(task: unknown, fallbackTimecode?: number): ExtractedTask | null {
    if (!task || typeof task !== "object") {
      return null;
    }

    const record = task as JsonRecord;
    const title = this.getString(record.title)?.trim();
    if (!title) {
      return null;
    }

    const category = this.validateEnhancedCategory(record.category);
    const priority = this.validateEnhancedPriority(record.priority);
    const explicitTimecode = this.getNonNegativeInt(record.timecode);
    const details = this.getString(record.details);

    return {
      title,
      category,
      priority,
      timecode: explicitTimecode ?? fallbackTimecode,
      details,
    };
  }

  private validateCategorizeResult(parsed: JsonRecord, fallbackTotal: number): CategorizeCommentsResult {
    const rawCategories = parsed.categories;
    if (!rawCategories || typeof rawCategories !== "object") {
      throw new Error("Invalid response format");
    }

    const categories: Record<string, CategorizedComment[]> = {};
    for (const [category, items] of Object.entries(rawCategories as Record<string, unknown>)) {
      if (!Array.isArray(items)) {
        continue;
      }

      const normalizedItems = items
        .map((item) => this.validateCategorizedComment(item, category))
        .filter((item): item is CategorizedComment => item !== null);

      if (normalizedItems.length > 0) {
        categories[category] = normalizedItems;
      }
    }

    if (Object.keys(categories).length === 0) {
      throw new Error("Invalid response format");
    }

    const byCategory: Record<string, number> = {};
    const byPriority: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    let uniqueCommentsFromCategories = 0;
    let totalCommentsFromCategories = 0;

    for (const [category, items] of Object.entries(categories)) {
      byCategory[category] = items.length;
      totalCommentsFromCategories += items.length;
      for (const item of items) {
        if (!item.isDuplicate) {
          uniqueCommentsFromCategories += 1;
        }
        byPriority[item.priority] += 1;
      }
    }

    const summary = parsed.summary && typeof parsed.summary === "object" ? (parsed.summary as JsonRecord) : undefined;
    const totalComments =
      this.getNonNegativeInt(summary?.totalComments) ?? (totalCommentsFromCategories || fallbackTotal);
    const uniqueComments = this.getNonNegativeInt(summary?.uniqueComments) ?? uniqueCommentsFromCategories;

    return {
      categories,
      summary: {
        totalComments,
        uniqueComments,
        byCategory,
        byPriority,
      },
    };
  }

  private validateCategorizedComment(item: unknown, fallbackCategory: string): CategorizedComment | null {
    if (!item || typeof item !== "object") {
      return null;
    }

    const record = item as JsonRecord;
    const id = this.getString(record.id)?.trim();
    if (!id) {
      return null;
    }

    const isDuplicate = typeof record.isDuplicate === "boolean" ? record.isDuplicate : false;
    const duplicateOf = this.getString(record.duplicateOf);
    const rawSimilarity = this.getNumber(record.similarityScore);
    const similarityScore = typeof rawSimilarity === "number" ? this.clamp01(rawSimilarity) : undefined;

    return {
      id,
      category: this.getString(record.category) ?? fallbackCategory,
      priority: this.validateEnhancedPriority(record.priority),
      isDuplicate,
      duplicateOf,
      similarityScore,
    };
  }

  private mergeCategorizeResults(results: CategorizeCommentsResult[]): CategorizeCommentsResult {
    if (results.length === 1) {
      return results[0];
    }

    const categories: Record<string, CategorizedComment[]> = {};
    const byPriority: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    let totalComments = 0;
    let uniqueComments = 0;

    for (const result of results) {
      totalComments += result.summary.totalComments;
      uniqueComments += result.summary.uniqueComments;
      for (const [priority, count] of Object.entries(result.summary.byPriority)) {
        if (priority === "HIGH" || priority === "MEDIUM" || priority === "LOW") {
          byPriority[priority] += this.getNonNegativeInt(count) ?? 0;
        }
      }

      for (const [category, items] of Object.entries(result.categories)) {
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(...items);
      }
    }

    const byCategory: Record<string, number> = {};
    for (const [category, items] of Object.entries(categories)) {
      byCategory[category] = items.length;
    }

    return {
      categories,
      summary: {
        totalComments,
        uniqueComments,
        byCategory,
        byPriority,
      },
    };
  }

  private validateEnhancedCategory(value: unknown): ExtractedTask["category"] {
    const normalized = typeof value === "string" ? value.toUpperCase() : "";
    if (normalized === "DESIGN" || normalized === "AUDIO" || normalized === "CONTENT" || normalized === "TECHNICAL") {
      return normalized;
    }
    return "OTHER";
  }

  private validateEnhancedPriority(value: unknown): ExtractedTask["priority"] {
    const normalized = typeof value === "string" ? value.toUpperCase() : "";
    if (normalized === "HIGH" || normalized === "LOW") {
      return normalized;
    }
    return "MEDIUM";
  }

  private validateRecommendation(value: unknown): AnalyzeWithBriefResult["recommendation"] {
    const normalized = typeof value === "string" ? value.toUpperCase() : "";
    if (normalized === "APPROVE" || normalized === "DECLINE" || normalized === "REQUEST_INFO") {
      return normalized;
    }
    return "REQUEST_INFO";
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  private isTransientOpenAIError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }

    const openAIError = error as { code?: unknown; status?: unknown };
    const code = typeof openAIError.code === "string" ? openAIError.code : "";
    const status = typeof openAIError.status === "number" ? openAIError.status : undefined;

    return code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ENOTFOUND" || status === 408 || status === 429;
  }

  private trackTokenUsage(usage: unknown): void {
    if (!usage || typeof usage !== "object") {
      return;
    }

    const payload = usage as {
      prompt_tokens?: unknown;
      completion_tokens?: unknown;
      total_tokens?: unknown;
    };

    const promptTokens = this.getNonNegativeInt(payload.prompt_tokens) ?? 0;
    const completionTokens = this.getNonNegativeInt(payload.completion_tokens) ?? 0;
    const totalTokens = this.getNonNegativeInt(payload.total_tokens) ?? promptTokens + completionTokens;

    this.tokenUsage.promptTokens += promptTokens;
    this.tokenUsage.completionTokens += completionTokens;
    this.tokenUsage.totalTokens += totalTokens;
    this.tokenUsage.estimatedUsd += promptTokens * 0.0000025 + completionTokens * 0.00001;
  }

  private normalizeOpenAIError(prefix: string, error: unknown): Error {
    if (error instanceof Error && error.message === "Invalid JSON response from OpenAI") {
      return error;
    }

    if (error instanceof Error && error.message === "OPENAI_API_KEY is required") {
      return error;
    }

    if (error && typeof error === "object") {
      const openAIError = error as { code?: unknown; status?: unknown; message?: unknown };
      const code = typeof openAIError.code === "string" ? openAIError.code : "";
      const status = typeof openAIError.status === "number" ? openAIError.status : undefined;
      const message = typeof openAIError.message === "string" ? openAIError.message : "Unknown error";

      if (code === "insufficient_quota" || status === 429) {
        return new Error("OpenAI API quota exceeded");
      }
      if (code === "invalid_api_key" || status === 401) {
        return new Error("Invalid OpenAI API key");
      }
      if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ENOTFOUND") {
        return new Error("OpenAI network error");
      }

      return new Error(`${prefix}: ${message}`);
    }

    return new Error(`${prefix}: Unexpected error`);
  }
}

export { AIService as AiService };
export const aiService = new AIService();
