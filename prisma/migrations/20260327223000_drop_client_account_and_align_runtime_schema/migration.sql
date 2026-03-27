ALTER TABLE "public"."Project" DROP CONSTRAINT IF EXISTS "Project_clientAccountId_fkey";
ALTER TABLE "public"."Project" DROP COLUMN IF EXISTS "clientAccountId";

DROP TABLE IF EXISTS "public"."ClientAccount";

ALTER TABLE "public"."AssetVersion" ADD COLUMN IF NOT EXISTS "title" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Project'
      AND column_name = 'portalToken'
  ) THEN
    ALTER TABLE "public"."Project" ADD COLUMN "portalToken" TEXT;
  END IF;
END $$;

UPDATE "public"."Project"
SET "portalToken" = COALESCE("portalToken", md5(random()::text || clock_timestamp()::text || id));

ALTER TABLE "public"."Project" ALTER COLUMN "portalToken" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'Project_portalToken_key'
  ) THEN
    CREATE UNIQUE INDEX "Project_portalToken_key" ON "public"."Project"("portalToken");
  END IF;
END $$;
