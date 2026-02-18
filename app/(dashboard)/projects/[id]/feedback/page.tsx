"use client";

import useSWR from "swr";
import { useParams } from "next/navigation";
import { FeedbackItem } from "@/components/feedback/feedback-item";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/utils/client-api";
import type { FeedbackResponse } from "@/types";

const fetcher = (url: string) => apiFetch<FeedbackResponse[]>(url);

export default function ProjectFeedbackPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { data, isLoading, error } = useSWR(`/api/projects/${projectId}/feedback`, fetcher);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Project Feedback</h1>
      {isLoading && (
        <Card className="animate-pulse">
          <CardContent className="h-28 p-6" />
        </Card>
      )}
      {error && !isLoading && (
        <Card>
          <CardContent className="py-6 text-sm text-red-600">Failed to load feedback.</CardContent>
        </Card>
      )}
      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="py-6 text-sm text-neutral-500">No feedback yet for this project.</CardContent>
        </Card>
      )}
      <div className="space-y-3">
        {data?.map((feedback) => (
          <FeedbackItem key={feedback.id} feedback={feedback} />
        ))}
      </div>
    </section>
  );
}
