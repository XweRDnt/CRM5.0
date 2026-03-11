"use client";

import Link from "next/link";
import useSWR from "swr";
import { AlertCircle } from "lucide-react";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { useAuthGuard } from "@/lib/hooks/use-auth-guard";
import { apiFetch } from "@/lib/utils/client-api";
import type { ProjectResponse } from "@/types";

const fetcher = (url: string) => apiFetch<ProjectResponse[]>(url);

function ProjectGridSkeleton(): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={`project-skeleton-${index}`} className="animate-pulse border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900/50">
          <CardContent className="space-y-4 p-6">
            <div className="h-5 w-2/3 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="h-4 w-1/3 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="h-4 w-1/2 rounded bg-neutral-200 dark:bg-neutral-700" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ProjectsPage(): JSX.Element {
  const { data: projects, error, isLoading, mutate } = useSWR("/api/projects", fetcher);
  const { user } = useAuthGuard();
  const isEditor = user?.role === "EDITOR";
  const canDelete = user?.role === "OWNER" || user?.role === "PM";

  const handleDeleteProject = async (projectId: string, projectName: string): Promise<void> => {
    const confirmed = window.confirm(`Р Р€Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ Р С—РЎР‚Р С•Р ВµР С”РЎвЂљ "${projectName}"? Р вЂ™РЎРѓР Вµ Р Р†Р ВµРЎР‚РЎРѓР С‘Р С‘ Р С‘ Р С”Р С•Р СР СР ВµР Р…РЎвЂљР В°РЎР‚Р С‘Р С‘ Р В±РЎС“Р Т‘РЎС“РЎвЂљ РЎС“Р Т‘Р В°Р В»Р ВµР Р…РЎвЂ№.`);
    if (!confirmed) {
      return;
    }

    try {
      await apiFetch(`/api/projects/${projectId}`, { method: "DELETE" });
      await mutate((prev) => (prev ?? []).filter((project) => project.id !== projectId), { revalidate: true });
      toast.success("Р СџРЎР‚Р С•Р ВµР С”РЎвЂљ РЎС“Р Т‘Р В°Р В»РЎвЂР Р…");
    } catch {
      toast.error("Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ РЎС“Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ Р С—РЎР‚Р С•Р ВµР С”РЎвЂљ");
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Р СџРЎР‚Р С•Р ВµР С”РЎвЂљРЎвЂ№</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Р Р€Р С—РЎР‚Р В°Р Р†Р В»РЎРЏР в„–РЎвЂљР Вµ Р Р†Р ВµРЎР‚РЎРѓР С‘РЎРЏР СР С‘ Р Р†Р С‘Р Т‘Р ВµР С• Р С‘ Р С”Р С•Р СР СР ВµР Р…РЎвЂљР В°РЎР‚Р С‘РЎРЏР СР С‘ Р С”Р В»Р С‘Р ВµР Р…РЎвЂљР С•Р Р†.</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">+ Р СњР С•Р Р†РЎвЂ№Р в„– Р С—РЎР‚Р С•Р ВµР С”РЎвЂљ</Link>
        </Button>
      </header>

      {isLoading && <ProjectGridSkeleton />}

      {error && !isLoading && (
        <Card className="border-red-200 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10">
          <CardContent className="flex items-center gap-2 py-6 text-red-700 dark:text-red-200">
            <AlertCircle className="h-4 w-4" />
            Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С‘РЎвЂљРЎРЉ Р С—РЎР‚Р С•Р ВµР С”РЎвЂљРЎвЂ№.
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (projects?.length ?? 0) === 0 && (
        <Card className="border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900/50">
          <CardContent className="py-10 text-center text-sm text-neutral-600 dark:text-neutral-400">
            {isEditor ? "Р вЂ™Р В»Р В°Р Т‘Р ВµР В»Р ВµРЎвЂ  Р ВµРЎвЂ°РЎвЂ Р Р…Р Вµ Р Т‘Р С•Р В±Р В°Р Р†Р С‘Р В» Р Р†Р В°РЎРѓ Р Р…Р С‘ Р Р† Р С•Р Т‘Р С‘Р Р… Р С—РЎР‚Р С•Р ВµР С”РЎвЂљ" : "Р СџР С•Р С”Р В° Р Р…Р ВµРЎвЂљ Р С—РЎР‚Р С•Р ВµР С”РЎвЂљР С•Р Р†. Р РЋР С•Р В·Р Т‘Р В°Р в„–РЎвЂљР Вµ Р С—Р ВµРЎР‚Р Р†РЎвЂ№Р в„– Р С—РЎР‚Р С•Р ВµР С”РЎвЂљ Р Т‘Р В»РЎРЏ РЎРѓР В±Р С•РЎР‚Р В° Р С—РЎР‚Р В°Р Р†Р С•Р С”."}
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
              onDelete={(id, name) => void handleDeleteProject(id, name)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
