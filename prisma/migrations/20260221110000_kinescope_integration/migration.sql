CREATE TYPE "public"."VideoProvider" AS ENUM ('KINESCOPE', 'EXTERNAL_URL', 'YOUTUBE_LEGACY');

CREATE TYPE "public"."VideoProcessingStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED');

ALTER TABLE "public"."AssetVersion"
ADD COLUMN "videoProvider" "public"."VideoProvider" NOT NULL DEFAULT 'EXTERNAL_URL',
ADD COLUMN "kinescopeVideoId" TEXT,
ADD COLUMN "kinescopeAssetId" TEXT,
ADD COLUMN "kinescopeProjectId" TEXT,
ADD COLUMN "streamUrl" TEXT,
ADD COLUMN "processingStatus" "public"."VideoProcessingStatus" NOT NULL DEFAULT 'READY',
ADD COLUMN "processingError" TEXT;

UPDATE "public"."AssetVersion"
SET "videoProvider" = 'YOUTUBE_LEGACY'
WHERE "fileUrl" ILIKE '%youtube.com%' OR "fileUrl" ILIKE '%youtu.be%';

CREATE TABLE "public"."VideoUploadSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kinescopeVideoId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" "public"."VideoProcessingStatus" NOT NULL DEFAULT 'UPLOADING',
    "streamUrl" TEXT,
    "durationSec" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VideoUploadSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VideoUploadSession_kinescopeVideoId_key" ON "public"."VideoUploadSession"("kinescopeVideoId");
CREATE INDEX "VideoUploadSession_tenantId_projectId_idx" ON "public"."VideoUploadSession"("tenantId", "projectId");
CREATE INDEX "AssetVersion_kinescopeVideoId_idx" ON "public"."AssetVersion"("kinescopeVideoId");

ALTER TABLE "public"."VideoUploadSession" ADD CONSTRAINT "VideoUploadSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."VideoUploadSession" ADD CONSTRAINT "VideoUploadSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
