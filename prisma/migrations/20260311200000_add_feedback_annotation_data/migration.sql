-- Add annotation data to feedback
ALTER TABLE "public"."FeedbackItem" ADD COLUMN "annotationData" JSONB;
