import { BillingPlanCode, type Prisma, WorkspaceBillingCycle, WorkspaceSubscriptionEventType, WorkspaceSubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { APIError } from "@/lib/utils/api-error";

export type WorkspacePlanLimits = {
  maxProjects: number | null;
  maxMembers: number | null;
  maxTrafficGb: number | null;
  maxStorageGb: number | null;
  maxTranscodingMinutes: number | null;
};

export type WorkspaceSubscriptionDetails = {
  subscriptionId: string;
  workspaceId: string;
  status: WorkspaceSubscriptionStatus;
  cycle: WorkspaceBillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  plan: {
    code: BillingPlanCode;
    name: string;
    currency: string;
    priceMinor: number;
    isActive: boolean;
    sortOrder: number;
  } & WorkspacePlanLimits;
  lastPayment: {
    amountMinor: number | null;
    currency: string | null;
    at: Date | null;
    comment: string | null;
  };
  updatedAt: Date;
};

export type WorkspaceSubscriptionEventDTO = {
  id: string;
  type: WorkspaceSubscriptionEventType;
  oldPlanCode: BillingPlanCode | null;
  newPlanCode: BillingPlanCode | null;
  paymentAmountMinor: number | null;
  paymentCurrency: string | null;
  paymentAt: Date | null;
  comment: string | null;
  actorUserId: string | null;
  createdAt: Date;
  metaJson: Prisma.JsonValue | null;
};

export type AssignWorkspacePlanInput = {
  workspaceId: string;
  planCode: BillingPlanCode;
  actorUserId: string;
  paymentAmountMinor: number;
  paymentCurrency: string;
  paymentAt: Date;
  paymentComment: string;
};

function toNumber(value: Prisma.Decimal | null): number | null {
  return value ? Number(value.toString()) : null;
}

function getCurrentMonthPeriod(reference = new Date()): { start: Date; end: Date } {
  const start = new Date(reference);
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

function mapSubscription(payload: {
  id: string;
  workspaceId: string;
  status: WorkspaceSubscriptionStatus;
  cycle: WorkspaceBillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  lastPaymentAmountMinor: number | null;
  lastPaymentCurrency: string | null;
  lastPaymentAt: Date | null;
  lastPaymentComment: string | null;
  updatedAt: Date;
  plan: {
    code: BillingPlanCode;
    name: string;
    currency: string;
    priceMinor: number;
    isActive: boolean;
    sortOrder: number;
    maxProjects: number | null;
    maxMembers: number | null;
    maxTrafficGb: Prisma.Decimal | null;
    maxStorageGb: Prisma.Decimal | null;
    maxTranscodingMinutes: Prisma.Decimal | null;
  };
}): WorkspaceSubscriptionDetails {
  return {
    subscriptionId: payload.id,
    workspaceId: payload.workspaceId,
    status: payload.status,
    cycle: payload.cycle,
    currentPeriodStart: payload.currentPeriodStart,
    currentPeriodEnd: payload.currentPeriodEnd,
    plan: {
      code: payload.plan.code,
      name: payload.plan.name,
      currency: payload.plan.currency,
      priceMinor: payload.plan.priceMinor,
      isActive: payload.plan.isActive,
      sortOrder: payload.plan.sortOrder,
      maxProjects: payload.plan.maxProjects,
      maxMembers: payload.plan.maxMembers,
      maxTrafficGb: toNumber(payload.plan.maxTrafficGb),
      maxStorageGb: toNumber(payload.plan.maxStorageGb),
      maxTranscodingMinutes: toNumber(payload.plan.maxTranscodingMinutes),
    },
    lastPayment: {
      amountMinor: payload.lastPaymentAmountMinor,
      currency: payload.lastPaymentCurrency,
      at: payload.lastPaymentAt,
      comment: payload.lastPaymentComment,
    },
    updatedAt: payload.updatedAt,
  };
}

async function ensureWorkspaceExists(workspaceId: string): Promise<void> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });
  if (!workspace) {
    throw new APIError(404, "Workspace not found", "NOT_FOUND");
  }
}

async function ensurePlanExists(code: BillingPlanCode): Promise<void> {
  const plan = await prisma.billingPlan.findUnique({
    where: { code },
    select: { code: true, isActive: true },
  });
  if (!plan) {
    throw new APIError(404, "Plan not found", "NOT_FOUND");
  }
  if (!plan.isActive) {
    throw new APIError(400, "Plan is inactive", "BAD_REQUEST");
  }
}

async function ensureDefaultFreePlanExists(): Promise<void> {
  await prisma.billingPlan.upsert({
    where: { code: BillingPlanCode.FREE },
    update: {
      isActive: true,
      name: "Free",
      currency: "USD",
      priceMinor: 0,
      sortOrder: 0,
    },
    create: {
      code: BillingPlanCode.FREE,
      name: "Free",
      currency: "USD",
      priceMinor: 0,
      isActive: true,
      sortOrder: 0,
    },
  });
}

export class WorkspaceSubscriptionService {
  async ensureWorkspaceSubscription(workspaceId: string): Promise<WorkspaceSubscriptionDetails> {
    await ensureWorkspaceExists(workspaceId);
    await ensureDefaultFreePlanExists();

    const existing = await prisma.workspaceSubscription.findUnique({
      where: { workspaceId },
      include: { plan: true },
    });

    if (existing) {
      if (existing.currentPeriodEnd <= new Date()) {
        const { start, end } = getCurrentMonthPeriod();
        const rolledOver = await prisma.workspaceSubscription.update({
          where: { id: existing.id },
          data: {
            currentPeriodStart: start,
            currentPeriodEnd: end,
            cycle: WorkspaceBillingCycle.CALENDAR_MONTH,
          },
          include: { plan: true },
        });
        return mapSubscription(rolledOver);
      }

      return mapSubscription(existing);
    }

    const { start, end } = getCurrentMonthPeriod();
    const created = await prisma.workspaceSubscription.create({
      data: {
        workspaceId,
        planCode: BillingPlanCode.FREE,
        status: WorkspaceSubscriptionStatus.ACTIVE,
        cycle: WorkspaceBillingCycle.CALENDAR_MONTH,
        currentPeriodStart: start,
        currentPeriodEnd: end,
      },
      include: { plan: true },
    });

    return mapSubscription(created);
  }

  async getWorkspaceSubscription(workspaceId: string): Promise<WorkspaceSubscriptionDetails> {
    return this.ensureWorkspaceSubscription(workspaceId);
  }

  async getWorkspaceSubscriptionByTenant(tenantId: string): Promise<WorkspaceSubscriptionDetails> {
    const workspace = await prisma.workspace.findUnique({
      where: { tenantId },
      select: { id: true },
    });

    if (!workspace) {
      throw new APIError(404, "Workspace not found", "NOT_FOUND");
    }

    return this.ensureWorkspaceSubscription(workspace.id);
  }

  async assignWorkspacePlan(input: AssignWorkspacePlanInput): Promise<WorkspaceSubscriptionDetails> {
    const paymentComment = input.paymentComment?.trim();
    const paymentCurrency = input.paymentCurrency?.trim().toUpperCase();

    if (!Number.isInteger(input.paymentAmountMinor) || input.paymentAmountMinor < 0) {
      throw new APIError(400, "paymentAmountMinor must be a non-negative integer", "BAD_REQUEST");
    }
    if (!paymentCurrency) {
      throw new APIError(400, "paymentCurrency is required", "BAD_REQUEST");
    }
    if (!(input.paymentAt instanceof Date) || Number.isNaN(input.paymentAt.getTime())) {
      throw new APIError(400, "paymentAt must be a valid date", "BAD_REQUEST");
    }
    if (!paymentComment) {
      throw new APIError(400, "paymentComment is required", "BAD_REQUEST");
    }

    await ensureWorkspaceExists(input.workspaceId);
    await ensurePlanExists(input.planCode);

    const now = new Date();
    const { start, end } = getCurrentMonthPeriod(now);

    const existing = await prisma.workspaceSubscription.findUnique({
      where: { workspaceId: input.workspaceId },
      select: { id: true, planCode: true },
    });

    const oldPlanCode = existing?.planCode ?? null;

    const updated = await prisma.$transaction(async (tx) => {
      const subscription = existing
        ? await tx.workspaceSubscription.update({
            where: { id: existing.id },
            data: {
              planCode: input.planCode,
              status: WorkspaceSubscriptionStatus.ACTIVE,
              cycle: WorkspaceBillingCycle.CALENDAR_MONTH,
              currentPeriodStart: start,
              currentPeriodEnd: end,
              lastPaymentAmountMinor: input.paymentAmountMinor,
              lastPaymentCurrency: paymentCurrency,
              lastPaymentAt: input.paymentAt,
              lastPaymentComment: paymentComment,
              assignedByUserId: input.actorUserId,
            },
            include: { plan: true },
          })
        : await tx.workspaceSubscription.create({
            data: {
              workspaceId: input.workspaceId,
              planCode: input.planCode,
              status: WorkspaceSubscriptionStatus.ACTIVE,
              cycle: WorkspaceBillingCycle.CALENDAR_MONTH,
              currentPeriodStart: start,
              currentPeriodEnd: end,
              lastPaymentAmountMinor: input.paymentAmountMinor,
              lastPaymentCurrency: paymentCurrency,
              lastPaymentAt: input.paymentAt,
              lastPaymentComment: paymentComment,
              assignedByUserId: input.actorUserId,
            },
            include: { plan: true },
          });

      await tx.workspaceSubscriptionEvent.create({
        data: {
          workspaceId: input.workspaceId,
          workspaceSubscriptionId: subscription.id,
          type: WorkspaceSubscriptionEventType.PLAN_ASSIGNED,
          oldPlanCode,
          newPlanCode: input.planCode,
          paymentAmountMinor: input.paymentAmountMinor,
          paymentCurrency,
          paymentAt: input.paymentAt,
          comment: paymentComment,
          actorUserId: input.actorUserId,
        },
      });

      await tx.workspaceSubscriptionEvent.create({
        data: {
          workspaceId: input.workspaceId,
          workspaceSubscriptionId: subscription.id,
          type: WorkspaceSubscriptionEventType.PAYMENT_RECORDED,
          oldPlanCode,
          newPlanCode: input.planCode,
          paymentAmountMinor: input.paymentAmountMinor,
          paymentCurrency,
          paymentAt: input.paymentAt,
          comment: paymentComment,
          actorUserId: input.actorUserId,
        },
      });

      return subscription;
    });

    return mapSubscription(updated);
  }

  async listWorkspaceSubscriptionEvents(workspaceId: string, limit = 50): Promise<WorkspaceSubscriptionEventDTO[]> {
    await ensureWorkspaceExists(workspaceId);

    const events = await prisma.workspaceSubscriptionEvent.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.min(limit, 200)),
    });

    return events.map((event) => ({
      id: event.id,
      type: event.type,
      oldPlanCode: event.oldPlanCode,
      newPlanCode: event.newPlanCode,
      paymentAmountMinor: event.paymentAmountMinor,
      paymentCurrency: event.paymentCurrency,
      paymentAt: event.paymentAt,
      comment: event.comment,
      actorUserId: event.actorUserId,
      createdAt: event.createdAt,
      metaJson: event.metaJson,
    }));
  }

  async appendWorkspaceStatusEvent(input: {
    workspaceId: string;
    actorUserId: string;
    type: WorkspaceSubscriptionEventType;
    comment?: string;
  }): Promise<void> {
    const subscription = await this.ensureWorkspaceSubscription(input.workspaceId);

    await prisma.workspaceSubscriptionEvent.create({
      data: {
        workspaceId: input.workspaceId,
        workspaceSubscriptionId: subscription.subscriptionId,
        type: input.type,
        oldPlanCode: subscription.plan.code,
        newPlanCode: subscription.plan.code,
        actorUserId: input.actorUserId,
        comment: input.comment?.trim() || null,
      },
    });
  }
}

export const workspaceSubscriptionService = new WorkspaceSubscriptionService();
