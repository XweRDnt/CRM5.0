ALTER TABLE "Project" ADD COLUMN "portalToken" TEXT;

UPDATE "Project"
SET "portalToken" = 'pt_' || md5("id" || ':' || clock_timestamp()::text || ':' || random()::text)
WHERE "portalToken" IS NULL;

ALTER TABLE "Project" ALTER COLUMN "portalToken" SET NOT NULL;

CREATE UNIQUE INDEX "Project_portalToken_key" ON "Project"("portalToken");
