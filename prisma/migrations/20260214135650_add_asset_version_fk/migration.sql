-- Step 1: Add nullable columns
ALTER TABLE "AssetVersion" ADD COLUMN "fileKey" TEXT;
ALTER TABLE "AssetVersion" ADD COLUMN "uploadedByUserId" TEXT;

-- Step 2: Backfill uploadedByUserId from legacy uploadedBy
UPDATE "AssetVersion"
SET "uploadedByUserId" = "uploadedBy"
WHERE "uploadedBy" IS NOT NULL;

-- Step 3: Backfill fileKey from project and fileName data
-- Format: tenants/{tenantId}/projects/{projectId}/versions/{id}.{ext}
UPDATE "AssetVersion" av
SET "fileKey" = 'tenants/' || p."tenantId" || '/projects/' || av."projectId" || '/versions/' || av.id ||
                CASE
                  WHEN LOWER(av."fileName") LIKE '%.mp4' THEN '.mp4'
                  WHEN LOWER(av."fileName") LIKE '%.mov' THEN '.mov'
                  WHEN LOWER(av."fileName") LIKE '%.avi' THEN '.avi'
                  ELSE '.mp4'
                END
FROM "Project" p
WHERE av."projectId" = p.id;

-- Step 4: Enforce NOT NULL
ALTER TABLE "AssetVersion" ALTER COLUMN "fileKey" SET NOT NULL;
ALTER TABLE "AssetVersion" ALTER COLUMN "uploadedByUserId" SET NOT NULL;

-- Step 5: Add FK and index
ALTER TABLE "AssetVersion"
ADD CONSTRAINT "AssetVersion_uploadedByUserId_fkey"
FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "AssetVersion_uploadedByUserId_idx" ON "AssetVersion"("uploadedByUserId");

-- Step 6 (optional): legacy column kept for compatibility
-- ALTER TABLE "AssetVersion" DROP COLUMN "uploadedBy";
