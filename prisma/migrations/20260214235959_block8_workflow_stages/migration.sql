-- Redefine workflow enum values for the project lifecycle stages.
CREATE TYPE "public"."WorkflowStageName_new" AS ENUM (
  'BRIEFING',
  'PRODUCTION',
  'CLIENT_REVIEW',
  'REVISIONS',
  'APPROVAL',
  'DELIVERY',
  'COMPLETED'
);

ALTER TABLE "public"."WorkflowStage"
ALTER COLUMN "stageName" TYPE "public"."WorkflowStageName_new"
USING (
  CASE
    WHEN "stageName"::text = 'DRAFT' THEN 'BRIEFING'
    WHEN "stageName"::text = 'INTERNAL_QA' THEN 'PRODUCTION'
    WHEN "stageName"::text = 'CLIENT_REVIEW' THEN 'CLIENT_REVIEW'
    WHEN "stageName"::text = 'FINAL' THEN 'COMPLETED'
  END
)::"public"."WorkflowStageName_new";

DROP TYPE "public"."WorkflowStageName";
ALTER TYPE "public"."WorkflowStageName_new" RENAME TO "WorkflowStageName";

ALTER TABLE "public"."WorkflowStage"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "public"."WorkflowStage"
ADD CONSTRAINT "WorkflowStage_projectId_stageName_key" UNIQUE ("projectId", "stageName");

ALTER TABLE "public"."WorkflowStage"
ADD CONSTRAINT "WorkflowStage_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "WorkflowStage_projectId_idx" ON "public"."WorkflowStage"("projectId");
CREATE INDEX "WorkflowStage_stageName_idx" ON "public"."WorkflowStage"("stageName");
CREATE INDEX "WorkflowStage_startedAt_idx" ON "public"."WorkflowStage"("startedAt");
