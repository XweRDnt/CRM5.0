export interface ParseFeedbackEnhancedInput {
  text: string;
  isVoice: boolean;
  timecodeSec?: number;
  videoContext?: string;
}

export interface ParseFeedbackEnhancedResult {
  cleanedText: string;
  tasks: ExtractedTask[];
  confidence: number;
}

export interface ExtractedTask {
  title: string;
  category: "DESIGN" | "AUDIO" | "CONTENT" | "TECHNICAL" | "OTHER";
  priority: "HIGH" | "MEDIUM" | "LOW";
  timecode?: number;
  details?: string;
}

export interface CategorizeCommentsInput {
  id: string;
  text: string;
  timecodeSec?: number;
}

export interface CategorizedComment {
  id: string;
  category: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  isDuplicate: boolean;
  duplicateOf?: string;
  similarityScore?: number;
}

export interface CategorizeCommentsResult {
  categories: Record<string, CategorizedComment[]>;
  summary: {
    totalComments: number;
    uniqueComments: number;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
  };
}

export interface AnalyzeWithBriefInput {
  commentText: string;
  projectBrief: string;
  existingTasks?: string[];
}

export interface AnalyzeWithBriefResult {
  inScope: boolean;
  confidence: number;
  reasoning: string;
  recommendation: "APPROVE" | "DECLINE" | "REQUEST_INFO";
  estimatedExtraHours?: number;
  suggestedResponse?: string;
}
