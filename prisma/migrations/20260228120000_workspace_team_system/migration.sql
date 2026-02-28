-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'EDITOR');

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_links" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invite_links_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN "addedBy" TEXT;
ALTER TABLE "ProjectMember" ADD COLUMN "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_tenantId_key" ON "workspaces"("tenantId");
CREATE INDEX "workspaces_ownerId_idx" ON "workspaces"("ownerId");
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key" ON "workspace_members"("workspaceId", "userId");
CREATE INDEX "workspace_members_workspaceId_idx" ON "workspace_members"("workspaceId");
CREATE INDEX "workspace_members_userId_idx" ON "workspace_members"("userId");
CREATE INDEX "workspace_members_role_idx" ON "workspace_members"("role");
CREATE UNIQUE INDEX "invite_links_token_key" ON "invite_links"("token");
CREATE INDEX "invite_links_workspaceId_idx" ON "invite_links"("workspaceId");
CREATE INDEX "invite_links_createdBy_idx" ON "invite_links"("createdBy");
CREATE INDEX "invite_links_expiresAt_idx" ON "invite_links"("expiresAt");
CREATE INDEX "invite_links_isActive_idx" ON "invite_links"("isActive");
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");
CREATE INDEX "ProjectMember_addedBy_idx" ON "ProjectMember"("addedBy");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_addedBy_fkey" FOREIGN KEY ("addedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill workspaces per tenant
INSERT INTO "workspaces" ("id", "tenantId", "name", "ownerId", "createdAt")
SELECT
  'ws_' || md5(t."id" || ':' || clock_timestamp()::text || ':' || random()::text),
  t."id",
  t."name",
  COALESCE(owner_user."id", fallback_user."id"),
  t."createdAt"
FROM "Tenant" t
LEFT JOIN LATERAL (
  SELECT u."id"
  FROM "User" u
  WHERE u."tenantId" = t."id" AND u."role" = 'OWNER'
  ORDER BY u."createdAt" ASC
  LIMIT 1
) owner_user ON true
LEFT JOIN LATERAL (
  SELECT u."id"
  FROM "User" u
  WHERE u."tenantId" = t."id"
  ORDER BY u."createdAt" ASC
  LIMIT 1
) fallback_user ON true
WHERE COALESCE(owner_user."id", fallback_user."id") IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "workspaces" w WHERE w."tenantId" = t."id"
  );

-- Backfill workspace_members
INSERT INTO "workspace_members" ("id", "workspaceId", "userId", "role", "createdAt")
SELECT
  'wsm_' || md5(w."id" || ':' || u."id" || ':' || random()::text),
  w."id",
  u."id",
  CASE WHEN u."id" = w."ownerId" THEN 'OWNER'::"WorkspaceRole" ELSE 'EDITOR'::"WorkspaceRole" END,
  u."createdAt"
FROM "workspaces" w
JOIN "User" u ON u."tenantId" = w."tenantId"
WHERE NOT EXISTS (
  SELECT 1 FROM "workspace_members" wm
  WHERE wm."workspaceId" = w."id" AND wm."userId" = u."id"
);

-- Backfill ProjectMember.addedBy / addedAt
UPDATE "ProjectMember" pm
SET
  "addedAt" = COALESCE(pm."createdAt", CURRENT_TIMESTAMP),
  "addedBy" = owner_user."id"
FROM "Project" p
JOIN "workspaces" w ON w."tenantId" = p."tenantId"
LEFT JOIN LATERAL (
  SELECT u."id"
  FROM "User" u
  WHERE u."tenantId" = p."tenantId" AND u."role" = 'OWNER'
  ORDER BY u."createdAt" ASC
  LIMIT 1
) owner_user ON true
WHERE pm."projectId" = p."id";
