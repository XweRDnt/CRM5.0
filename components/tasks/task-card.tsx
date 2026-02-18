"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/utils/client-api";
import type { TaskResponse } from "@/types";

const statusBadgeMap = {
  TODO: "secondary",
  IN_PROGRESS: "default",
  DONE: "success",
  CANCELLED: "error",
} as const;

const priorityBadgeMap = {
  LOW: "secondary",
  MEDIUM: "default",
  HIGH: "warning",
  URGENT: "error",
} as const;

type TaskCardProps = {
  task: TaskResponse;
  onUpdated: () => void;
};

export function TaskCard({ task, onUpdated }: TaskCardProps): JSX.Element {
  const [saving, setSaving] = useState(false);

  const updateTask = async (payload: { status?: TaskResponse["status"]; assignedToUserId?: string | null }): Promise<void> => {
    setSaving(true);
    try {
      await apiFetch<TaskResponse>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      onUpdated();
      toast.success("Task updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-neutral-900">{task.title}</h3>
          <div className="flex items-center gap-2">
            <Badge variant={priorityBadgeMap[task.priority]}>{task.priority}</Badge>
            <Badge variant={statusBadgeMap[task.status]}>{task.status}</Badge>
          </div>
        </div>
        {task.description && <p className="text-sm text-neutral-600">{task.description}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</p>
            <Select
              value={task.status}
              onValueChange={(value: TaskResponse["status"]) => {
                void updateTask({ status: value });
              }}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODO">To do</SelectItem>
                <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                <SelectItem value="DONE">Done</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Assign To (User ID)</p>
            <Input
              placeholder="editor-user-id"
              defaultValue={task.assignedTo?.id ?? ""}
              onBlur={(event) => {
                const value = event.target.value.trim();
                void updateTask({ assignedToUserId: value || null });
              }}
              disabled={saving}
            />
          </div>
        </div>
        {saving && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
