ALTER TABLE "public"."Notification"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Notification_tenantId_idx" ON "public"."Notification"("tenantId");
CREATE INDEX "Notification_deliveryStatus_idx" ON "public"."Notification"("deliveryStatus");
CREATE INDEX "Notification_createdAt_idx" ON "public"."Notification"("createdAt");
