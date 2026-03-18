-- Create feedback thread messages table
CREATE TABLE "public"."FeedbackThreadMessage" (
    "id" TEXT NOT NULL,
    "feedbackItemId" TEXT NOT NULL,
    "authorType" "public"."AuthorType" NOT NULL,
    "authorUserId" TEXT,
    "authorName" TEXT NOT NULL,
    "authorRoleLabel" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackThreadMessage_pkey" PRIMARY KEY ("id")
);

-- Create feedback thread read state table
CREATE TABLE "public"."FeedbackThreadRead" (
    "id" TEXT NOT NULL,
    "feedbackItemId" TEXT NOT NULL,
    "userId" TEXT,
    "clientIdentity" TEXT,
    "lastReadAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackThreadRead_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "FeedbackThreadMessage_feedbackItemId_idx" ON "public"."FeedbackThreadMessage"("feedbackItemId");
CREATE INDEX "FeedbackThreadMessage_authorUserId_idx" ON "public"."FeedbackThreadMessage"("authorUserId");
CREATE INDEX "FeedbackThreadMessage_createdAt_idx" ON "public"."FeedbackThreadMessage"("createdAt");

CREATE INDEX "FeedbackThreadRead_feedbackItemId_idx" ON "public"."FeedbackThreadRead"("feedbackItemId");
CREATE INDEX "FeedbackThreadRead_userId_idx" ON "public"."FeedbackThreadRead"("userId");
CREATE INDEX "FeedbackThreadRead_clientIdentity_idx" ON "public"."FeedbackThreadRead"("clientIdentity");

CREATE UNIQUE INDEX "FeedbackThreadRead_feedbackItemId_userId_key" ON "public"."FeedbackThreadRead"("feedbackItemId", "userId");
CREATE UNIQUE INDEX "FeedbackThreadRead_feedbackItemId_clientIdentity_key" ON "public"."FeedbackThreadRead"("feedbackItemId", "clientIdentity");

-- Foreign keys
ALTER TABLE "public"."FeedbackThreadMessage"
ADD CONSTRAINT "FeedbackThreadMessage_feedbackItemId_fkey"
FOREIGN KEY ("feedbackItemId") REFERENCES "public"."FeedbackItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."FeedbackThreadMessage"
ADD CONSTRAINT "FeedbackThreadMessage_authorUserId_fkey"
FOREIGN KEY ("authorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."FeedbackThreadRead"
ADD CONSTRAINT "FeedbackThreadRead_feedbackItemId_fkey"
FOREIGN KEY ("feedbackItemId") REFERENCES "public"."FeedbackItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
