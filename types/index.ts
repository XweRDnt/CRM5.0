export enum UserRole {
  OWNER = "owner",
  PM = "pm",
  EDITOR = "editor",
  CLIENT_VIEWER = "client_viewer",
}

export enum ProjectStatus {
  DRAFT = "draft",
  IN_PROGRESS = "in_progress",
  CLIENT_REVIEW = "client_review",
  COMPLETED = "completed",
  ON_HOLD = "on_hold",
  CANCELLED = "cancelled",
}

export enum FeedbackStatus {
  NEW = "new",
  IN_PROGRESS = "in_progress",
  RESOLVED = "resolved",
  REJECTED = "rejected",
}

export enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export enum TaskState {
  TODO = "todo",
  IN_PROGRESS = "in_progress",
  DONE = "done",
  CANCELLED = "cancelled",
}

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

export type Tenant = {
  id: string;
  name: string;
  plan: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
};

export type User = {
  id: string;
  tenantId: string;
  role: UserRole;
  name: string;
  email: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

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
  createdAt: Date;
};

export type FeedbackItem = {
  id: string;
  assetVersionId: string;
  text: string;
  status: FeedbackStatus;
  timecodeSec?: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AITask = {
  id: string;
  projectId: string;
  summary: string;
  priority: TaskPriority;
  state: TaskState;
  createdAt: Date;
  updatedAt: Date;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginOutput = {
  token: string;
  user: User;
  tenant: Tenant;
};

export type SignupInput = {
  tenantName: string;
  ownerName: string;
  email: string;
  password: string;
};

export type CreateClientInput = {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  notes?: string;
};

export type CreateProjectInput = {
  clientAccountId: string;
  name: string;
  description?: string;
  dueDate?: string;
};

export type CreateAssetVersionInput = {
  projectId: string;
  versionNo: number;
  fileUrl: string;
  fileName: string;
  fileSize: number;
};

export type CreateFeedbackInput = {
  assetVersionId: string;
  text: string;
  timecodeSec?: number;
};

export type ParsedActionItem = {
  summary: string;
  priority: TaskPriority;
  sourceFeedbackId: string;
};

export type ParseFeedbackInput = {
  feedbackIds: string[];
};

export type ParseFeedbackOutput = {
  items: ParsedActionItem[];
};

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
