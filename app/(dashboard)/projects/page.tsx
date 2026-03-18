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
  const isEditor = user?.role === "EDITOR";
  const canDelete = user?.role === "OWNER" || user?.role === "PM";

  const handleDeleteProject = async (projectId: string, projectName: string): Promise<void> => {
    const confirmed = window.confirm(`РЈРґР°Р»РёС‚СЊ РїСЂРѕРµРєС‚ "${projectName}"? Р’СЃРµ РІРµСЂСЃРёРё Рё РєРѕРјРјРµРЅС‚Р°СЂРёРё Р±СѓРґСѓС‚ СѓРґР°Р»РµРЅС‹.`);
    if (!confirmed) {
      return;
    }

    try {
      await apiFetch(`/api/projects/${projectId}`, { method: "DELETE" });
      await mutate((prev) => (prev ?? []).filter((project) => project.id !== projectId), { revalidate: true });
      toast.success("РџСЂРѕРµРєС‚ СѓРґР°Р»С‘РЅ");
    } catch {
      toast.error("РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РїСЂРѕРµРєС‚");
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">РџСЂРѕРµРєС‚С‹</h1>
          <p className="text-sm glass-muted">РЈРїСЂР°РІР»СЏР№С‚Рµ РІРµСЂСЃРёСЏРјРё РІРёРґРµРѕ Рё РєРѕРјРјРµРЅС‚Р°СЂРёСЏРјРё РєР»РёРµРЅС‚РѕРІ.</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">+ РќРѕРІС‹Р№ РїСЂРѕРµРєС‚</Link>
        </Button>
      </header>

      {isLoading && <ProjectGridSkeleton />}

      {error && !isLoading && (
        <Card className="glass-card border-red-500/40 bg-red-500/10">
          <CardContent className="flex items-center gap-2 py-6 text-red-200">
            <AlertCircle className="h-4 w-4" />
            РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РїСЂРѕРµРєС‚С‹.
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (projects?.length ?? 0) === 0 && (
        <Card className="glass-card">
          <CardContent className="py-10 text-center text-sm glass-muted">
            {isEditor ? "Р’Р»Р°РґРµР»РµС† РµС‰С‘ РЅРµ РґРѕР±Р°РІРёР» РІР°СЃ РЅРё РІ РѕРґРёРЅ РїСЂРѕРµРєС‚" : "РџРѕРєР° РЅРµС‚ РїСЂРѕРµРєС‚РѕРІ. РЎРѕР·РґР°Р№С‚Рµ РїРµСЂРІС‹Р№ РїСЂРѕРµРєС‚ РґР»СЏ СЃР±РѕСЂР° РїСЂР°РІРѕРє."}
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

