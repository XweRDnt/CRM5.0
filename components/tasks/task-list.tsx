"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TaskCard } from "@/components/tasks/task-card";
import type { TaskResponse } from "@/types";

type TaskListProps = {
  tasks: TaskResponse[];
  loading: boolean;
  onUpdated: () => void;
};

export function TaskList({ tasks, loading, onUpdated }: TaskListProps): JSX.Element {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={`task-skeleton-${index}`} className="animate-pulse">
            <CardContent className="space-y-3 p-5">
              <div className="h-5 w-1/2 rounded bg-neutral-200" />
              <div className="h-4 w-5/6 rounded bg-neutral-200" />
              <div className="h-10 rounded bg-neutral-200" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-neutral-500">No tasks found for current filters.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onUpdated={onUpdated} />
      ))}
    </div>
  );
}
