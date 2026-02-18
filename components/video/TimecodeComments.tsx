"use client";

import { Button } from "@/components/ui/button";

export type TimecodeComment = {
  id: string;
  text: string;
  timecodeSec: number;
  authorName?: string;
};

type TimecodeCommentsProps = {
  comments: TimecodeComment[];
  onSeek?: (timecodeSec: number) => void;
};

export function TimecodeComments({ comments, onSeek }: TimecodeCommentsProps): JSX.Element {
  if (comments.length === 0) {
    return <div className="rounded border border-neutral-200 p-4 text-sm text-neutral-500">No timecode comments yet.</div>;
  }

  return (
    <div className="space-y-2">
      {comments.map((comment) => (
        <div key={comment.id} className="rounded-lg border border-neutral-200 p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs text-neutral-500">{comment.authorName || "Anonymous"}</p>
            <Button size="sm" type="button" variant="outline" onClick={() => onSeek?.(comment.timecodeSec)}>
              t={comment.timecodeSec}s
            </Button>
          </div>
          <p className="text-sm text-neutral-800">{comment.text}</p>
        </div>
      ))}
    </div>
  );
}
