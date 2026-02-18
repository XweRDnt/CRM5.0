import { FeedbackItem } from "@/components/feedback/feedback-item";
import { Card, CardContent } from "@/components/ui/card";
import type { FeedbackResponse } from "@/types";

type FeedbackListProps = {
  items: FeedbackResponse[];
};

export function FeedbackList({ items }: FeedbackListProps): JSX.Element {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral-500">No feedback items yet.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <FeedbackItem key={item.id} feedback={item} />
      ))}
    </div>
  );
}
