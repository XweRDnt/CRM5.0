"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type TaskFiltersState = {
  status: "all" | "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  priority: "all" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
};

type TaskFiltersProps = {
  filters: TaskFiltersState;
  setFilters: (filters: TaskFiltersState) => void;
};

export function TaskFilters({ filters, setFilters }: TaskFiltersProps): JSX.Element {
  return (
    <div className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-2">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</p>
        <Select
          value={filters.status}
          onValueChange={(value: TaskFiltersState["status"]) => setFilters({ ...filters, status: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="TODO">To do</SelectItem>
            <SelectItem value="IN_PROGRESS">In progress</SelectItem>
            <SelectItem value="DONE">Done</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Priority</p>
        <Select
          value={filters.priority}
          onValueChange={(value: TaskFiltersState["priority"]) => setFilters({ ...filters, priority: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
