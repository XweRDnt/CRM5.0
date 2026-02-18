"use client";

import useSWR from "swr";
import { useParams } from "next/navigation";
import { TaskList } from "@/components/tasks/task-list";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/utils/client-api";
import type { TaskResponse } from "@/types";

const fetcher = (url: string) => apiFetch<TaskResponse[]>(url);

export default function ProjectTasksPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { data, isLoading, error, mutate } = useSWR(`/api/tasks?projectId=${projectId}`, fetcher);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Project Tasks</h1>
      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-red-600">Failed to load tasks.</CardContent>
        </Card>
      )}
      {!error && <TaskList tasks={data ?? []} loading={isLoading} onUpdated={() => void mutate()} />}
    </section>
  );
}
