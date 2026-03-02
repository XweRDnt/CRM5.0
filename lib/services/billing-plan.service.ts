import { BillingPlanCode, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { APIError } from "@/lib/utils/api-error";

export type BillingPlanDTO = {
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
  createdAt: Date;
  updatedAt: Date;
};

export type BillingPlanPatchInput = {
  name?: string;
  currency?: string;
  priceMinor?: number;
  isActive?: boolean;
  sortOrder?: number;
  maxProjects?: number | null;
  maxMembers?: number | null;
  maxTrafficGb?: number | null;
  maxStorageGb?: number | null;
  maxTranscodingMinutes?: number | null;
};

function toNumber(value: Prisma.Decimal | null): number | null {
  return value ? Number(value.toString()) : null;
}

function mapPlan(plan: {
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
  createdAt: Date;
  updatedAt: Date;
}): BillingPlanDTO {
  return {
    code: plan.code,
    name: plan.name,
    currency: plan.currency,
    priceMinor: plan.priceMinor,
    isActive: plan.isActive,
    sortOrder: plan.sortOrder,
    maxProjects: plan.maxProjects,
    maxMembers: plan.maxMembers,
    maxTrafficGb: toNumber(plan.maxTrafficGb),
    maxStorageGb: toNumber(plan.maxStorageGb),
    maxTranscodingMinutes: toNumber(plan.maxTranscodingMinutes),
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

function assertNonNegativeInt(field: string, value: number | undefined): void {
  if (value === undefined) {
    return;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new APIError(400, `${field} must be a non-negative integer`, "BAD_REQUEST");
  }
}

function assertNonNegativeNumber(field: string, value: number | null | undefined): void {
  if (value === undefined || value === null) {
    return;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new APIError(400, `${field} must be a non-negative number`, "BAD_REQUEST");
  }
}

export class BillingPlanService {
  async listPlans(): Promise<BillingPlanDTO[]> {
    const plans = await prisma.billingPlan.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });

    return plans.map((plan) => mapPlan(plan));
  }

  async getPlan(code: BillingPlanCode): Promise<BillingPlanDTO> {
    const plan = await prisma.billingPlan.findUnique({
      where: { code },
    });

    if (!plan) {
      throw new APIError(404, "Plan not found", "NOT_FOUND");
    }

    return mapPlan(plan);
  }

  async updatePlan(code: BillingPlanCode, input: BillingPlanPatchInput): Promise<BillingPlanDTO> {
    const hasAnyChange = Object.values(input).some((value) => value !== undefined);
    if (!hasAnyChange) {
      throw new APIError(400, "At least one field is required", "BAD_REQUEST");
    }

    assertNonNegativeInt("priceMinor", input.priceMinor);
    assertNonNegativeInt("sortOrder", input.sortOrder);
    assertNonNegativeInt("maxProjects", input.maxProjects ?? undefined);
    assertNonNegativeInt("maxMembers", input.maxMembers ?? undefined);
    assertNonNegativeNumber("maxTrafficGb", input.maxTrafficGb);
    assertNonNegativeNumber("maxStorageGb", input.maxStorageGb);
    assertNonNegativeNumber("maxTranscodingMinutes", input.maxTranscodingMinutes);

    if (input.name !== undefined && input.name.trim().length === 0) {
      throw new APIError(400, "name must not be empty", "BAD_REQUEST");
    }

    if (input.currency !== undefined && input.currency.trim().length === 0) {
      throw new APIError(400, "currency must not be empty", "BAD_REQUEST");
    }

    const plan = await prisma.billingPlan.update({
      where: { code },
      data: {
        name: input.name?.trim(),
        currency: input.currency?.trim().toUpperCase(),
        priceMinor: input.priceMinor,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
        maxProjects: input.maxProjects,
        maxMembers: input.maxMembers,
        maxTrafficGb: input.maxTrafficGb,
        maxStorageGb: input.maxStorageGb,
        maxTranscodingMinutes: input.maxTranscodingMinutes,
      },
    });

    return mapPlan(plan);
  }
}

export const billingPlanService = new BillingPlanService();

