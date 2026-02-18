"use client";

import Link from "next/link";
import useSWR from "swr";
import { AlertCircle } from "lucide-react";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/utils/client-api";
import type { ClientResponse, ProjectResponse, TaskResponse } from "@/types";

const projectsFetcher = (url: string) => apiFetch<ProjectResponse[]>(url);
const clientsFetcher = (url: string) => apiFetch<ClientResponse[]>(url);
const tasksFetcher = (url: string) => apiFetch<TaskResponse[]>(url);

export default function DashboardPage(): JSX.Element {
  const { data: projects, error: projectsError, isLoading: projectsLoading } = useSWR("/api/projects", projectsFetcher);
  const { data: clients, isLoading: clientsLoading } = useSWR("/api/clients", clientsFetcher);
  const { data: tasks, isLoading: tasksLoading } = useSWR("/api/tasks", tasksFetcher);

  const openTasks = tasks?.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Button asChild>
          <Link href="/projects/new">New Project</Link>
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="space-y-0 border-b border-neutral-200 px-4 pb-2 pt-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Projects</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-3">
            <p className="text-3xl font-semibold">{projectsLoading ? "--" : (projects?.length ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-0 border-b border-neutral-200 px-4 pb-2 pt-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Clients</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-3">
            <p className="text-3xl font-semibold">{clientsLoading ? "--" : (clients?.length ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-0 border-b border-neutral-200 px-4 pb-2 pt-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Open Tasks</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-3">
            <p className="text-3xl font-semibold">{tasksLoading ? "--" : openTasks}</p>
          </CardContent>
        </Card>
      </section>

      {projectsLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={`dashboard-project-${index}`} className="animate-pulse">
              <CardContent className="space-y-3 p-6">
                <div className="h-5 w-1/2 rounded bg-neutral-200" />
                <div className="h-4 w-1/3 rounded bg-neutral-200" />
                <div className="h-4 w-1/4 rounded bg-neutral-200" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {projectsError && !projectsLoading && (
        <Card>
          <CardContent className="flex items-center gap-2 pt-6 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            Failed to load projects.
          </CardContent>
        </Card>
      )}

      {!projectsLoading && !projectsError && (projects?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-sm text-neutral-500">No projects yet.</p>
            <Button asChild>
              <Link href="/projects/new">Create your first project</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {projects?.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
