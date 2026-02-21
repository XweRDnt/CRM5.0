import {
  UserRole,
  ProjectStatus,
  AuthorType,
  FeedbackCategory,
  FeedbackStatus,
  TaskStatus,
  TaskPriority,
  ScopeLabel,
  PMDecision,
  WorkflowStageName,
  SubscriptionPlan,
  SubscriptionStatus,
  NotificationChannel,
  DeliveryStatus,
  VersionStatus,
  VideoProvider,
  VideoProcessingStatus,
} from "@prisma/client";

export {
  UserRole,
  ProjectStatus,
  AuthorType,
  FeedbackCategory,
  FeedbackStatus,
  TaskStatus,
  TaskPriority,
  ScopeLabel,
  PMDecision,
  WorkflowStageName,
  SubscriptionPlan,
  SubscriptionStatus,
  NotificationChannel,
  DeliveryStatus,
  VersionStatus,
  VideoProvider,
  VideoProcessingStatus,
};

export type ServiceContext = {
  tenantId: string;
  userId?: string;
  role?: UserRole;
};

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  tenantId: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
}

export type ClientAccount = {
  id: string;
  tenantId: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Project = {
  id: string;
  tenantId: string;
  clientAccountId: string;
  name: string;
  status: ProjectStatus;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type AssetVersion = {
  id: string;
  projectId: string;
  versionNo: number;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  videoProvider: VideoProvider;
  kinescopeVideoId: string | null;
  streamUrl: string | null;
  processingStatus: VideoProcessingStatus;
  changeLog: string | null;
  status: VersionStatus;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
};

export type FeedbackItem = {
  id: string;
  assetVersionId: string;
  authorType: AuthorType;
  authorId?: string | null;
  authorEmail?: string | null;
  authorName?: string | null;
  text: string;
  status: FeedbackStatus;
  timecodeSec?: number | null;
  category?: FeedbackCategory | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AITask = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category: FeedbackCategory;
  assignedToUserId: string | null;
  estimatedMinutes: number | null;
  dueDate: Date | null;
  completedAt: Date | null;
  sourceFeedbackIds: string[];
  aiGenerated: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export interface SignupInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantName: string;
  tenantSlug: string;
}

export type SignupResult = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  token: string;
};

export type LoginResult = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    tenantId: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  token: string;
};

export type JWTPayload = {
  userId: string;
  tenantId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
};

export type LoginInput = {
  email: string;
  password: string;
};

export interface CreateClientInput {
  tenantId: string;
  name: string;
  email: string;
  phone?: string;
  companyName?: string;
}

export interface ClientResponse {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectInput {
  tenantId: string;
  name: string;
  description?: string;
  clientId: string;
  brief?: string;
  revisionsLimit?: number;
}

export interface ProjectFilters {
  clientId?: string;
  status?: ProjectStatus;
}

export interface ProjectResponse {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  clientId: string;
  client: {
    id: string;
    name: string;
    email: string;
  };
  brief: string | null;
  revisionsLimit: number;
  revisionsUsed: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDefaultStagesInput {
  projectId: string;
  tenantId: string;
}

export interface WorkflowStageResponse {
  id: string;
  projectId: string;
  stageName: WorkflowStageName;
  slaHours: number;
  startedAt: Date | null;
  completedAt: Date | null;
  owner: {
    id: string;
    name: string;
  } | null;
  isActive: boolean;
  isOverdue: boolean;
  remainingHours: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransitionToStageInput {
  projectId: string;
  tenantId: string;
  stageName: WorkflowStageName;
  ownerUserId?: string;
}

export interface CompleteProjectInput {
  projectId: string;
  tenantId: string;
}

export interface StageMetrics {
  totalStages: number;
  completedStages: number;
  activeStage: WorkflowStageName | null;
  overdueStages: number;
  averageCompletionHours: number;
}

export interface GetUploadUrlInput {
  tenantId: string;
  projectId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  uploadMethod: "PUT" | "POST";
  uploadHeaders?: Record<string, string>;
  uploadFields?: Record<string, string>;
  kinescopeVideoId: string;
  expiresAt: string;
  expiresIn: number;
  fileKey?: string;
  fileUrl?: string;
}

export interface ConfirmUploadInput {
  tenantId: string;
  projectId: string;
  kinescopeVideoId: string;
}

export interface ConfirmUploadResponse {
  kinescopeVideoId: string;
  processingStatus: VideoProcessingStatus;
  streamUrl: string | null;
  durationSec: number | null;
  processingError: string | null;
}

export interface CreateVersionInput {
  projectId: string;
  tenantId: string;
  versionNo?: number;
  fileUrl?: string;
  fileKey?: string;
  fileName: string;
  fileSize: number;
  durationSec?: number;
  uploadedByUserId: string;
  notes?: string;
  videoProvider?: VideoProvider;
  kinescopeVideoId?: string;
  kinescopeAssetId?: string;
  kinescopeProjectId?: string;
  streamUrl?: string;
  processingStatus?: VideoProcessingStatus;
  processingError?: string;
}

export interface AssetVersionResponse {
  id: string;
  projectId: string;
  versionNumber: number;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  durationSec: number | null;
  videoProvider: VideoProvider;
  kinescopeVideoId: string | null;
  kinescopeAssetId: string | null;
  kinescopeProjectId: string | null;
  streamUrl: string | null;
  processingStatus: VideoProcessingStatus;
  processingError: string | null;
  uploadedBy: {
    id: string;
    name: string;
  };
  notes: string | null;
  changeLog: string | null;
  status: VersionStatus;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
}

export type CreateAssetVersionInput = {
  projectId: string;
  versionNo: number;
  fileUrl: string;
  fileName: string;
  fileSize: number;
};

export interface CreateFeedbackInput {
  assetVersionId: string;
  tenantId: string;
  authorType: AuthorType;
  authorId?: string;
  authorEmail?: string;
  authorName?: string;
  timecodeSec?: number;
  text: string;
  category?: FeedbackCategory;
}

export interface FeedbackResponse {
  id: string;
  assetVersionId: string;
  authorType: AuthorType;
  author: {
    id?: string;
    name: string;
    email?: string;
  };
  timecodeSec: number | null;
  text: string;
  category: FeedbackCategory | null;
  status: FeedbackStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateFeedbackStatusInput {
  feedbackId: string;
  tenantId: string;
  status: FeedbackStatus;
}

export interface ParseFeedbackInput {
  feedbackItems: Array<{
    id: string;
    text: string;
    timecodeSec?: number;
    category?: FeedbackCategory;
    authorName: string;
  }>;
  projectContext?: {
    name: string;
    brief?: string;
  };
}

export interface ActionItem {
  text: string;
  priority: TaskPriority;
  category: FeedbackCategory;
  suggestedAssignee?: string;
  estimatedMinutes?: number;
  sourceFeedbackIds: string[];
}

export interface CreateTaskInput {
  projectId: string;
  tenantId: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  category: FeedbackCategory;
  assignedToUserId?: string;
  estimatedMinutes?: number;
  dueDate?: Date;
  sourceFeedbackIds?: string[];
  aiGenerated?: boolean;
}

export interface CreateTasksFromActionItemsInput {
  projectId: string;
  tenantId: string;
  actionItems: ActionItem[];
  autoAssign?: boolean;
}

export interface TaskResponse {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category: FeedbackCategory;
  assignedTo: {
    id: string;
    name: string;
  } | null;
  estimatedMinutes: number | null;
  dueDate: Date | null;
  completedAt: Date | null;
  sourceFeedbackIds: string[];
  aiGenerated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateTaskInput {
  taskId: string;
  tenantId: string;
  status?: TaskStatus;
  assignedToUserId?: string;
  dueDate?: Date;
  completedAt?: Date;
}

export interface TaskFilters {
  projectId?: string;
  assignedToUserId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: FeedbackCategory;
}

export interface SendEmailInput {
  tenantId: string;
  to: string;
  subject: string;
  body: string;
  templateKey?: string;
  payload?: Record<string, unknown>;
}

export interface NotificationResponse {
  id: string;
  tenantId: string;
  channel: NotificationChannel;
  recipient: string;
  templateKey: string;
  sentAt: Date | null;
  deliveryStatus: DeliveryStatus;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotifyPMAboutNewFeedbackInput {
  tenantId: string;
  projectId: string;
  feedbackId: string;
  pmEmail: string;
}

export interface NotifyClientAboutNewVersionInput {
  tenantId: string;
  projectId: string;
  versionId: string;
  clientEmail: string;
  clientName: string;
}

export interface NotifyAboutOverdueStageInput {
  tenantId: string;
  projectId: string;
  stageName: string;
  pmEmail: string;
}

export interface ParsedFeedbackResult {
  summary: string;
  actionItems: ActionItem[];
  dedupedCount: number;
  totalFeedbackProcessed: number;
}

export interface GenerateClientUpdateInput {
  projectName: string;
  completedTasks: Array<{
    title: string;
    category: FeedbackCategory;
  }>;
  nextSteps?: string;
}

export interface ClientUpdateResult {
  subject: string;
  body: string;
  tone: "professional" | "friendly" | "formal";
}

export interface AnalyzeScopeInput {
  feedbackText: string;
  feedbackId: string;
  projectScope: string;
  projectName: string;
}

export interface ScopeAnalysisResult {
  label: ScopeLabel;
  confidence: number;
  reasoning: string;
  suggestedAction: string;
  estimatedCost?: number;
}

export interface CreateScopeDecisionInput {
  projectId: string;
  feedbackItemId: string;
  tenantId: string;
  aiLabel: ScopeLabel;
  aiConfidence: number;
  aiReasoning?: string;
}

export interface ScopeDecisionResponse {
  id: string;
  projectId: string;
  feedbackItemId: string;
  aiLabel: ScopeLabel;
  aiConfidence: number;
  aiReasoning: string | null;
  pmDecision: PMDecision | null;
  pmReason: string | null;
  changeRequestAmount: number | null;
  decidedBy: {
    id: string;
    name: string;
  } | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MakePMDecisionInput {
  scopeDecisionId: string;
  tenantId: string;
  pmUserId: string;
  decision: PMDecision;
  reason?: string;
  changeRequestAmount?: number;
}

export interface ChangeRequestTemplate {
  subject: string;
  body: string;
  estimatedCost: number;
  estimatedDays: number;
}

export type P1MethodCard = {
  id: string;
  method: string;
  goal: string;
  input: string;
  output: string;
  happyPath: string;
  edgeCases: string[];
  definitionOfDone: string[];
};

