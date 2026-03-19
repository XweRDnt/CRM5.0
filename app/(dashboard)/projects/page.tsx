"use client";

import Link from "next/link";
import useSWR from "swr";
import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { toast } from "@/components/ui/toast";
import { useAuthGuard } from "@/lib/hooks/use-auth-guard";
import { apiFetch } from "@/lib/utils/client-api";
import type { ProjectResponse } from "@/types";

const fetcher = (url: string) => apiFetch<ProjectResponse[]>(url);

function ProjectGridSkeleton(): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={`project-skeleton-${index}`} className="animate-pulse glass-card">
          <CardContent className="space-y-4 p-6">
            <div className="h-5 w-2/3 rounded bg-white/10" />
            <div className="h-4 w-1/3 rounded bg-white/10" />
            <div className="h-4 w-1/2 rounded bg-white/10" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ProjectsPage(): JSX.Element {
  const { data: projects, error, isLoading, mutate } = useSWR("/api/projects", fetcher);
  const { user } = useAuthGuard();
  const [pendingDeleteProject, setPendingDeleteProject] = useState<{ id: string; name: string } | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const isEditor = user?.role === "EDITOR";
  const canDelete = user?.role === "OWNER" || user?.role === "PM";

  const handleDeleteProject = async (projectId: string): Promise<void> => {
    setDeletingProject(true);
    try {
      await apiFetch(`/api/projects/${projectId}`, { method: "DELETE" });
      await mutate((prev) => (prev ?? []).filter((project) => project.id !== projectId), { revalidate: true });
      toast.success("Проект удалён");
      setPendingDeleteProject(null);
    } catch {
      toast.error("Не удалось удалить проект");
    } finally {
      setDeletingProject(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Проекты</h1>
          <p className="text-sm glass-muted">Управляйте версиями видео и комментариями клиентов.</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">+ Новый проект</Link>
        </Button>
      </header>

      {isLoading && <ProjectGridSkeleton />}

      {error && !isLoading && (
        <Card className="glass-card border-red-500/40 bg-red-500/10">
          <CardContent className="flex items-center gap-2 py-6 text-red-200">
            <AlertCircle className="h-4 w-4" />
            Не удалось загрузить проекты.
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (projects?.length ?? 0) === 0 && (
        <Card className="glass-card">
          <CardContent className="py-10 text-center text-sm glass-muted">
            {isEditor ? "Владелец ещё не добавил вас ни в один проект" : "Пока нет проектов. Создайте первый проект для сбора правок."}
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (projects?.length ?? 0) > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects?.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              canDelete={canDelete}
              onDelete={(id, name) => setPendingDeleteProject({ id, name })}
            />
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={pendingDeleteProject !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteProject(null);
          }
        }}
        title="Вы точно уверены?"
        description={
          pendingDeleteProject
            ? `Проект "${pendingDeleteProject.name}" будет удалён без возможности восстановления.`
            : ""
        }
        loading={deletingProject}
        onConfirm={() => {
          if (!pendingDeleteProject) {
            return;
          }

          return handleDeleteProject(pendingDeleteProject.id);
        }}
      />
    </section>
  );
}
