"use client";

import Link from "next/link";
import useSWR from "swr";
import { AlertCircle } from "lucide-react";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/utils/client-api";
import type { ProjectResponse } from "@/types";

const fetcher = (url: string) => apiFetch<ProjectResponse[]>(url);

function ProjectGridSkeleton(): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={`project-skeleton-${index}`} className="animate-pulse">
          <CardContent className="space-y-4 p-6">
            <div className="h-5 w-2/3 rounded bg-neutral-200" />
            <div className="h-4 w-1/3 rounded bg-neutral-200" />
            <div className="h-4 w-1/2 rounded bg-neutral-200" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ProjectsPage(): JSX.Element {
  const { data: projects, error, isLoading } = useSWR("/api/projects", fetcher);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Проекты</h1>
          <p className="text-sm text-neutral-500">Управляйте версиями видео и комментариями клиентов.</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">+ Новый проект</Link>
        </Button>
      </header>

      {isLoading && <ProjectGridSkeleton />}

      {error && !isLoading && (
        <Card>
          <CardContent className="flex items-center gap-2 py-6 text-red-600">
            <AlertCircle className="h-4 w-4" />
            Не удалось загрузить проекты.
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (projects?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-neutral-500">
            Пока нет проектов. Создайте первый проект для сбора правок.
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (projects?.length ?? 0) > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects?.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </section>
  );
}
