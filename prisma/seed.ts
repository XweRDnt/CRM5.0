import { BillingPlanCode, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type DefaultPlan = {
  code: BillingPlanCode;
  name: string;
  priceMinor: number;
  sortOrder: number;
  maxProjects: number | null;
  maxMembers: number | null;
  maxTrafficGb: string | null;
  maxStorageGb: string | null;
  maxTranscodingMinutes: string | null;
};

async function seedBillingPlans(): Promise<void> {
  const defaults: DefaultPlan[] = [
    {
      code: BillingPlanCode.FREE,
      name: "Free",
      priceMinor: 0,
      sortOrder: 1,
      maxProjects: 1,
      maxMembers: 1,
      maxTrafficGb: "50",
      maxStorageGb: "20",
      maxTranscodingMinutes: "60",
    },
    {
      code: BillingPlanCode.START,
      name: "Start",
      priceMinor: 290_000,
      sortOrder: 2,
      maxProjects: 5,
      maxMembers: 5,
      maxTrafficGb: "500",
      maxStorageGb: "200",
      maxTranscodingMinutes: "600",
    },
    {
      code: BillingPlanCode.GROWTH,
      name: "Growth",
      priceMinor: 790_000,
      sortOrder: 3,
      maxProjects: 25,
      maxMembers: 15,
      maxTrafficGb: "2000",
      maxStorageGb: "800",
      maxTranscodingMinutes: "3000",
    },
    {
      code: BillingPlanCode.BUSINESS,
      name: "Business",
      priceMinor: 1_490_000,
      sortOrder: 4,
      maxProjects: null,
      maxMembers: null,
      maxTrafficGb: "8000",
      maxStorageGb: "3000",
      maxTranscodingMinutes: "12000",
    },
  ];

  for (const plan of defaults) {
    await prisma.billingPlan.upsert({
      where: { code: plan.code },
      create: {
        code: plan.code,
        name: plan.name,
        currency: "RUB",
        priceMinor: plan.priceMinor,
        isActive: true,
        sortOrder: plan.sortOrder,
        maxProjects: plan.maxProjects,
        maxMembers: plan.maxMembers,
        maxTrafficGb: plan.maxTrafficGb,
        maxStorageGb: plan.maxStorageGb,
        maxTranscodingMinutes: plan.maxTranscodingMinutes,
      },
      update: {
        name: plan.name,
        currency: "RUB",
        priceMinor: plan.priceMinor,
        isActive: true,
        sortOrder: plan.sortOrder,
        maxProjects: plan.maxProjects,
        maxMembers: plan.maxMembers,
        maxTrafficGb: plan.maxTrafficGb,
        maxStorageGb: plan.maxStorageGb,
        maxTranscodingMinutes: plan.maxTranscodingMinutes,
      },
    });
  }
}

async function seedWorkspaceSubscriptions(): Promise<void> {
  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);

  const periodEnd = new Date(periodStart);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

  const workspaces = await prisma.workspace.findMany({
    select: {
      id: true,
      subscription: {
        select: { id: true },
      },
    },
  });

  for (const workspace of workspaces) {
    if (workspace.subscription) {
      continue;
    }

    await prisma.workspaceSubscription.create({
      data: {
        workspaceId: workspace.id,
        planCode: BillingPlanCode.FREE,
        status: "ACTIVE",
        cycle: "CALENDAR_MONTH",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
    });
  }
}

async function main(): Promise<void> {
  await prisma.$connect();
  await seedBillingPlans();
  await seedWorkspaceSubscriptions();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
