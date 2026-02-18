"use client";

import { FeedbackForm as PublicFeedbackForm } from "@/components/feedback/feedback-form";
import { Card, CardContent } from "@/components/ui/card";

type FeedbackFormProps = {
  versionId?: string;
  capturedTimecodeSec?: number | null;
  onSubmitted?: () => void;
};

export function FeedbackForm({ versionId, capturedTimecodeSec, onSubmitted }: FeedbackFormProps): JSX.Element {
  if (!versionId) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral-500">
          Select a video version to submit feedback.
        </CardContent>
      </Card>
    );
  }

  return <PublicFeedbackForm capturedTimecodeSec={capturedTimecodeSec} onSubmitted={onSubmitted} versionId={versionId} />;
}
