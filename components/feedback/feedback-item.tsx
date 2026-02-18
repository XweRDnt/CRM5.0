import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatTimecode } from "@/lib/utils/time";
import type { FeedbackResponse } from "@/types";

export function FeedbackItem({ feedback }: { feedback: FeedbackResponse }): JSX.Element {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{feedback.author.name}</p>
          {feedback.timecodeSec !== null && <Badge variant="secondary">{formatTimecode(feedback.timecodeSec)}</Badge>}
          {feedback.category && <Badge variant="default">{feedback.category}</Badge>}
        </div>
        <p className="text-sm text-neutral-700">{feedback.text}</p>
      </CardContent>
    </Card>
  );
}
