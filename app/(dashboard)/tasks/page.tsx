"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { TaskFilters, type TaskFiltersState } from "@/components/tasks/task-filters";
import { TaskList } from "@/components/tasks/task-list";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/utils/client-api";
import type { TaskResponse } from "@/types";

const fetcher = (url: string) => apiFetch<TaskResponse[]>(url);

export default function TasksPage(): JSX.Element {
  const [filters, setFilters] = useState<TaskFiltersState>({
    status: "all",
    priority: "all",
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status !== "all") {
      params.set("status", filters.status);
    }
    if (filters.priority !== "all") {
      params.set("priority", filters.priority);
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [filters]);

  const { data: tasks, error, isLoading, mutate } = useSWR(`/api/tasks${queryString}`, fetcher);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <p className="text-sm text-neutral-500">Review AI-generated tasks and assign them to editors.</p>
      </header>

      <TaskFilters filters={filters} setFilters={setFilters} />

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-red-600">Failed to load tasks.</CardContent>
        </Card>
      )}

      {!error && <TaskList tasks={tasks ?? []} loading={isLoading} onUpdated={() => void mutate()} />}
    </section>
  );
}
