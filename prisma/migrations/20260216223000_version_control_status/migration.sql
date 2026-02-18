CREATE TYPE "public"."VersionStatus" AS ENUM (
  'DRAFT',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'FINAL'
);

ALTER TABLE "public"."AssetVersion"
ADD COLUMN "changeLog" TEXT,
ADD COLUMN "status" "public"."VersionStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "approvedBy" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3);
