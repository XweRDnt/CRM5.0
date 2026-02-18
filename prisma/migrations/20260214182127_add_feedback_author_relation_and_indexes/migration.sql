-- CreateIndex
CREATE INDEX "FeedbackItem_assetVersionId_idx" ON "public"."FeedbackItem"("assetVersionId");

-- CreateIndex
CREATE INDEX "FeedbackItem_authorId_idx" ON "public"."FeedbackItem"("authorId");

-- CreateIndex
CREATE INDEX "FeedbackItem_status_idx" ON "public"."FeedbackItem"("status");

-- AddForeignKey
ALTER TABLE "public"."FeedbackItem" ADD CONSTRAINT "FeedbackItem_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
