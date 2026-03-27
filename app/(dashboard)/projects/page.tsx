"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { AlertCircle } from "lucide-react";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: projects, error, isLoading, mutate } = useSWR("/api/projects", fetcher);
  const { user } = useAuthGuard();
  const [pendingDeleteProject, setPendingDeleteProject] = useState<{ id: string; name: string } | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const isEditor = user?.role === "EDITOR";
  const canDelete = !user?.isDemo && (user?.role === "OWNER" || user?.role === "PM");

  useEffect(() => {
    if (searchParams.get("create") !== "1") {
      return;
    }

    setIsCreateDialogOpen(true);
    router.replace("/projects");
  }, [router, searchParams]);

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

  const handleProjectCreated = (project: ProjectResponse): void => {
    void mutate((prev) => (prev ? [project, ...prev.filter((item) => item.id !== project.id)] : [project]), {
      revalidate: false,
    });
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Проекты</h1>
          <p className="text-sm glass-muted">Управляйте версиями видео и быстро запускайте новые согласования.</p>
        </div>
        {user?.isDemo ? null : (
          <CreateProjectDialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
            onCreated={handleProjectCreated}
            trigger={<Button type="button">+ Новый проект</Button>}
          />
        )}
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
          <CardContent className="space-y-5 py-10 text-center">
            <p className="text-sm glass-muted">
              {isEditor
                ? "Владелец ещё не добавил вас ни в один проект."
                : "Пока нет проектов. Создайте первый проект за несколько секунд."}
            </p>
            {!isEditor && !user?.isDemo ? (
              <CreateProjectDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onCreated={handleProjectCreated}
                trigger={<Button type="button">Создать первый проект</Button>}
              />
            ) : null}
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
        description={pendingDeleteProject ? `Проект "${pendingDeleteProject.name}" будет удалён без возможности восстановления.` : ""}
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
