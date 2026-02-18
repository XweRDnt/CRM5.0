-- Add updatedAt for Prisma @updatedAt support
ALTER TABLE "public"."ScopeDecision"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Enforce one ScopeDecision per FeedbackItem
CREATE UNIQUE INDEX IF NOT EXISTS "ScopeDecision_feedbackItemId_key"
  ON "public"."ScopeDecision"("feedbackItemId");

-- Add lookup indexes used by Prisma schema
CREATE INDEX IF NOT EXISTS "ScopeDecision_projectId_idx"
  ON "public"."ScopeDecision"("projectId");

CREATE INDEX IF NOT EXISTS "ScopeDecision_aiLabel_idx"
  ON "public"."ScopeDecision"("aiLabel");

CREATE INDEX IF NOT EXISTS "ScopeDecision_pmDecision_idx"
  ON "public"."ScopeDecision"("pmDecision");

-- Link manual PM decision actor to User
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ScopeDecision_decidedBy_fkey'
  ) THEN
    ALTER TABLE "public"."ScopeDecision"
      ADD CONSTRAINT "ScopeDecision_decidedBy_fkey"
      FOREIGN KEY ("decidedBy") REFERENCES "public"."User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
