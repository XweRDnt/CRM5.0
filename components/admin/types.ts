import { BillingPlanCode, WorkspaceSubscriptionEventType } from "@prisma/client";

export type PlanDTO = {
  code: BillingPlanCode;
  name: string;
  currency: string;
  priceMinor: number;
  isActive: boolean;
  sortOrder: number;
  maxProjects: number | null;
  maxMembers: number | null;
  maxTrafficGb: number | null;
  maxStorageGb: number | null;
  maxTranscodingMinutes: number | null;
};

export type WorkspaceRow = {
  workspaceId: string;
  tenantId: string;
  workspaceName: string;
  owner: {
    userId: string;
    email: string;
    fullName: string;
  };
  registeredAt: string;
  isBlocked: boolean;
  hasDedicatedKinescopeProject: boolean;
  isLegacy: boolean;
  billingTrackingStartedAt: string | null;
  subscription: {
    plan: {
      code: BillingPlanCode;
      name: string;
      currency: string;
      priceMinor: number;
      maxProjects: number | null;
      maxMembers: number | null;
      maxTrafficGb: number | null;
      maxStorageGb: number | null;
      maxTranscodingMinutes: number | null;
    };
    currentPeriodStart: string;
    currentPeriodEnd: string;
  };
  usage: {
    trafficGb: number;
    storageGb: number;
    transcodingMinutes: number;
    amountMinor: number;
    fetchedAt: string;
    expiresAt: string;
  } | null;
};

export type LocalUsageEstimate = {
  uniqueVideoCount: number;
  uploadSessionCount: number;
  assetVersionCount: number;
  linkedAssetVersionVideoCount: number;
  standaloneUploadVideoCount: number;
  videosWithDurationCount: number;
  periodTranscodingVideoCount: number;
  periodTranscodingSeconds: number;
  storageBytes: number;
  transcodingMinutes: number;
  trafficGb: number;
  sampleVideos: Array<{
    kinescopeVideoId: string;
    fileName: string;
    fileSize: number;
    durationSec: number | null;
    createdAt: string;
    sources: string[];
  }>;
};

export type WorkspaceDetail = {
  workspace: {
    workspaceId: string;
    tenantId: string;
    workspaceName: string;
    registeredAt: string;
    isBlocked: boolean;
    owner: {
      userId: string;
      email: string;
      fullName: string;
    };
    memberCount: number;
    projectCount: number;
    kinescopeProjectId: string | null;
    kinescopeProjectName: string | null;
    kinescopeProjectProvisionedAt: string | null;
    billingTrackingStartedAt: string | null;
    isLegacy: boolean;
  };
  subscription: {
    plan: PlanDTO;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    lastPayment: {
      amountMinor: number | null;
      currency: string | null;
      at: string | null;
      comment: string | null;
    };
  };
  usage: {
    trafficGb: number;
    storageGb: number;
    transcodingMinutes: number;
    amountMinor: number;
    periodStart: string;
    periodEnd: string;
    fetchedAt: string;
    expiresAt: string;
    reason: string | null;
    debug: {
      rowCount: number;
      projectIds: string[];
      products: string[];
    } | null;
    localEstimate: LocalUsageEstimate | null;
  } | null;
  events: Array<{
    id: string;
    type: WorkspaceSubscriptionEventType;
    oldPlanCode: BillingPlanCode | null;
    newPlanCode: BillingPlanCode | null;
    paymentAmountMinor: number | null;
    paymentCurrency: string | null;
    paymentAt: string | null;
    comment: string | null;
    actorUserId: string | null;
    createdAt: string;
  }>;
};

export type UsageRefreshResponse = {
  usage: {
    source: "cache" | "live" | "local" | "stale" | "unavailable";
    reason: string | null;
    debug: {
      rowCount: number;
      projectIds: string[];
      products: string[];
    } | null;
    localEstimate: LocalUsageEstimate | null;
  };
};
