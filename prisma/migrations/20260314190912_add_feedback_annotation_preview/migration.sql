-- Add annotation preview URL to feedback
ALTER TABLE "public"."FeedbackItem" ADD COLUMN "annotationPreview" TEXT;
