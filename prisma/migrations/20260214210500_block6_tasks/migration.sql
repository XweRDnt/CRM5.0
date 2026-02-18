-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- AlterTable
ALTER TABLE "public"."AITask"
  DROP COLUMN "summary",
  DROP COLUMN "assigneeUserId",
  DROP COLUMN "state",
  ADD COLUMN "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "assignedToUserId" TEXT,
  ADD COLUMN "category" "public"."FeedbackCategory" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "description" TEXT,
  ADD COLUMN "estimatedMinutes" INTEGER,
  ADD COLUMN "status" "public"."TaskStatus" NOT NULL DEFAULT 'TODO',
  ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Untitled task';

-- CreateIndex
CREATE INDEX "AITask_projectId_idx" ON "public"."AITask"("projectId");

-- CreateIndex
CREATE INDEX "AITask_assignedToUserId_idx" ON "public"."AITask"("assignedToUserId");

-- CreateIndex
CREATE INDEX "AITask_status_idx" ON "public"."AITask"("status");

-- CreateIndex
CREATE INDEX "AITask_priority_idx" ON "public"."AITask"("priority");

-- AddForeignKey
ALTER TABLE "public"."AITask"
  ADD CONSTRAINT "AITask_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "public"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- DropEnum
DROP TYPE "public"."TaskState";
