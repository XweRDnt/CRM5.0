-- Create billing enums (idempotent for reruns after partial failures)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'BillingPlanCode'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "BillingPlanCode" AS ENUM ('FREE', 'START', 'GROWTH', 'BUSINESS');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'WorkspaceSubscriptionStatus'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "WorkspaceSubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'WorkspaceBillingCycle'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "WorkspaceBillingCycle" AS ENUM ('CALENDAR_MONTH');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'WorkspaceSubscriptionEventType'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "WorkspaceSubscriptionEventType" AS ENUM ('PLAN_ASSIGNED', 'PAYMENT_RECORDED', 'WORKSPACE_BLOCKED', 'WORKSPACE_UNBLOCKED', 'LIMIT_BLOCKED');
  END IF;
END $$;

-- Extend workspace for Kinescope billing tracking
ALTER TABLE "workspaces"
ADD COLUMN IF NOT EXISTS "kinescopeProjectId" TEXT,
ADD COLUMN IF NOT EXISTS "kinescopeProjectName" TEXT,
ADD COLUMN IF NOT EXISTS "kinescopeProjectProvisionedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "billingTrackingStartedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_kinescopeProjectId_key" ON "workspaces"("kinescopeProjectId");

-- Billing plan catalog
CREATE TABLE IF NOT EXISTS "BillingPlan" (
    "code" "BillingPlanCode" NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "priceMinor" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "maxProjects" INTEGER,
    "maxMembers" INTEGER,
    "maxTrafficGb" DECIMAL(12,3),
    "maxStorageGb" DECIMAL(12,3),
    "maxTranscodingMinutes" DECIMAL(12,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("code")
);

CREATE INDEX IF NOT EXISTS "BillingPlan_isActive_sortOrder_idx" ON "BillingPlan"("isActive", "sortOrder");

-- Workspace subscriptions
CREATE TABLE IF NOT EXISTS "WorkspaceSubscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "planCode" "BillingPlanCode" NOT NULL,
    "status" "WorkspaceSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "cycle" "WorkspaceBillingCycle" NOT NULL DEFAULT 'CALENDAR_MONTH',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "lastPaymentAmountMinor" INTEGER,
    "lastPaymentCurrency" TEXT,
    "lastPaymentAt" TIMESTAMP(3),
    "lastPaymentComment" TEXT,
    "assignedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceSubscription_workspaceId_key" ON "WorkspaceSubscription"("workspaceId");
CREATE INDEX IF NOT EXISTS "WorkspaceSubscription_planCode_idx" ON "WorkspaceSubscription"("planCode");
CREATE INDEX IF NOT EXISTS "WorkspaceSubscription_status_idx" ON "WorkspaceSubscription"("status");
CREATE INDEX IF NOT EXISTS "WorkspaceSubscription_currentPeriodStart_currentPeriodEnd_idx" ON "WorkspaceSubscription"("currentPeriodStart", "currentPeriodEnd");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WorkspaceSubscription_workspaceId_fkey'
      AND conrelid = '"WorkspaceSubscription"'::regclass
  ) THEN
    ALTER TABLE "WorkspaceSubscription"
    ADD CONSTRAINT "WorkspaceSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WorkspaceSubscription_planCode_fkey'
      AND conrelid = '"WorkspaceSubscription"'::regclass
  ) THEN
    ALTER TABLE "WorkspaceSubscription"
    ADD CONSTRAINT "WorkspaceSubscription_planCode_fkey" FOREIGN KEY ("planCode") REFERENCES "BillingPlan"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WorkspaceSubscription_assignedByUserId_fkey'
      AND conrelid = '"WorkspaceSubscription"'::regclass
  ) THEN
    ALTER TABLE "WorkspaceSubscription"
    ADD CONSTRAINT "WorkspaceSubscription_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Workspace subscription events
CREATE TABLE IF NOT EXISTS "WorkspaceSubscriptionEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workspaceSubscriptionId" TEXT NOT NULL,
    "type" "WorkspaceSubscriptionEventType" NOT NULL,
    "oldPlanCode" "BillingPlanCode",
    "newPlanCode" "BillingPlanCode",
    "paymentAmountMinor" INTEGER,
    "paymentCurrency" TEXT,
    "paymentAt" TIMESTAMP(3),
    "comment" TEXT,
    "actorUserId" TEXT,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceSubscriptionEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkspaceSubscriptionEvent_workspaceId_createdAt_idx" ON "WorkspaceSubscriptionEvent"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkspaceSubscriptionEvent_workspaceSubscriptionId_createdAt_idx" ON "WorkspaceSubscriptionEvent"("workspaceSubscriptionId", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkspaceSubscriptionEvent_type_idx" ON "WorkspaceSubscriptionEvent"("type");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WorkspaceSubscriptionEvent_workspaceId_fkey'
      AND conrelid = '"WorkspaceSubscriptionEvent"'::regclass
  ) THEN
    ALTER TABLE "WorkspaceSubscriptionEvent"
    ADD CONSTRAINT "WorkspaceSubscriptionEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WorkspaceSubscriptionEvent_workspaceSubscriptionId_fkey'
      AND conrelid = '"WorkspaceSubscriptionEvent"'::regclass
  ) THEN
    ALTER TABLE "WorkspaceSubscriptionEvent"
    ADD CONSTRAINT "WorkspaceSubscriptionEvent_workspaceSubscriptionId_fkey" FOREIGN KEY ("workspaceSubscriptionId") REFERENCES "WorkspaceSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WorkspaceSubscriptionEvent_actorUserId_fkey'
      AND conrelid = '"WorkspaceSubscriptionEvent"'::regclass
  ) THEN
    ALTER TABLE "WorkspaceSubscriptionEvent"
    ADD CONSTRAINT "WorkspaceSubscriptionEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Usage cache snapshots
CREATE TABLE IF NOT EXISTS "KinescopeUsageSnapshot" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "trafficGb" DECIMAL(16,6),
    "storageGb" DECIMAL(16,6),
    "transcodingMinutes" DECIMAL(16,6),
    "amountMinor" INTEGER,
    "rawJson" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KinescopeUsageSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KinescopeUsageSnapshot_workspaceId_periodStart_periodEnd_key" ON "KinescopeUsageSnapshot"("workspaceId", "periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "KinescopeUsageSnapshot_workspaceId_expiresAt_idx" ON "KinescopeUsageSnapshot"("workspaceId", "expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'KinescopeUsageSnapshot_workspaceId_fkey'
      AND conrelid = '"KinescopeUsageSnapshot"'::regclass
  ) THEN
    ALTER TABLE "KinescopeUsageSnapshot"
    ADD CONSTRAINT "KinescopeUsageSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed editable default billing plans
INSERT INTO "BillingPlan" (
  "code",
  "name",
  "currency",
  "priceMinor",
  "isActive",
  "sortOrder",
  "maxProjects",
  "maxMembers",
  "maxTrafficGb",
  "maxStorageGb",
  "maxTranscodingMinutes",
  "updatedAt"
)
VALUES
  ('FREE', 'Free', 'RUB', 0, true, 1, 1, 1, 50, 20, 60, CURRENT_TIMESTAMP),
  ('START', 'Start', 'RUB', 290000, true, 2, 5, 5, 500, 200, 600, CURRENT_TIMESTAMP),
  ('GROWTH', 'Growth', 'RUB', 790000, true, 3, 25, 15, 2000, 800, 3000, CURRENT_TIMESTAMP),
  ('BUSINESS', 'Business', 'RUB', 1490000, true, 4, NULL, NULL, 8000, 3000, 12000, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "currency" = EXCLUDED."currency",
  "priceMinor" = EXCLUDED."priceMinor",
  "isActive" = EXCLUDED."isActive",
  "sortOrder" = EXCLUDED."sortOrder",
  "maxProjects" = EXCLUDED."maxProjects",
  "maxMembers" = EXCLUDED."maxMembers",
  "maxTrafficGb" = EXCLUDED."maxTrafficGb",
  "maxStorageGb" = EXCLUDED."maxStorageGb",
  "maxTranscodingMinutes" = EXCLUDED."maxTranscodingMinutes",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Backfill FREE subscription for all existing workspaces
INSERT INTO "WorkspaceSubscription" (
  "id",
  "workspaceId",
  "planCode",
  "status",
  "cycle",
  "currentPeriodStart",
  "currentPeriodEnd",
  "createdAt",
  "updatedAt"
)
SELECT
  'ws_sub_' || substr(md5(random()::text || clock_timestamp()::text || w."id"), 1, 24),
  w."id",
  'FREE'::"BillingPlanCode",
  'ACTIVE'::"WorkspaceSubscriptionStatus",
  'CALENDAR_MONTH'::"WorkspaceBillingCycle",
  date_trunc('month', now() AT TIME ZONE 'UTC'),
  date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "workspaces" w
WHERE NOT EXISTS (
  SELECT 1
  FROM "WorkspaceSubscription" ws
  WHERE ws."workspaceId" = w."id"
);
