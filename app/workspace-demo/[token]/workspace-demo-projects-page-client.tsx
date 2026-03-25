"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, FolderOpen, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/utils/client-api";

type WorkspaceDemoProjectsResponse = {
  workspace: {
    id: string;
    name: string;
  };
  readonly: true;
  projects: Array<{
    id: string;
    name: string;
    client: {
      id: string;
      name: string;
      email: string;
    };
    status: string;
    createdAt: string;
    latestVersionId: string | null;
    latestVersionNumber: number | null;
    latestVersionStatus: string | null;
    latestVersionStatusLabel: string;
  }>;
};

export function WorkspaceDemoProjectsPageClient({ token }: { token: string }): JSX.Element {
  const { data, isLoading, error } = useSWR(
    `/api/public/workspace-demo/${token}/projects`,
    apiFetch<WorkspaceDemoProjectsResponse>,
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(71,85,105,0.22),transparent_42%),linear-gradient(180deg,#0f172a,#020617)] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.55)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-100">
                <Lock className="h-3.5 w-3.5" />
                Read-only demo workspace
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {data?.workspace.name ?? "Workspace demo"}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">
                  Витрина внутреннего кабинета агентства: список проектов и рабочее review-пространство без логина и без любых записей.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              {data ? `Проектов в демо: ${data.projects.length}` : "Загружаю проекты..."}
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={`workspace-demo-skeleton-${index}`} className="border-white/10 bg-white/[0.04] text-slate-100">
                <CardContent className="space-y-4 p-6">
                  <div className="h-5 w-2/3 animate-pulse rounded bg-white/10" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
                  <div className="h-4 w-1/3 animate-pulse rounded bg-white/10" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {error ? (
          <Card className="border-red-400/25 bg-red-500/10 text-red-100">
            <CardContent className="p-6 text-sm">Не удалось загрузить demo workspace.</CardContent>
          </Card>
        ) : null}

        {data && data.projects.length === 0 ? (
          <Card className="border-white/10 bg-white/[0.04] text-slate-100">
            <CardContent className="p-8 text-center text-sm text-slate-300">
              В demo workspace пока нет проектов.
            </CardContent>
          </Card>
        ) : null}

        {data ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.projects.map((project) => {
              const href = project.latestVersionId
                ? `/workspace-demo/${token}/projects/${project.id}/versions/${project.latestVersionId}`
                : "#";

              return (
                <Card
                  key={project.id}
                  className="border-white/10 bg-white/[0.05] text-slate-100 shadow-[0_18px_48px_rgba(2,6,23,0.35)] transition hover:border-white/20 hover:bg-white/[0.07]"
                >
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-xl">{project.name}</CardTitle>
                        <p className="text-sm text-slate-300">{project.client.name}</p>
                      </div>
                      <div className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-xs font-medium text-sky-100">
                        {project.latestVersionStatusLabel}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2 text-sm text-slate-300">
                      <div className="flex items-center justify-between gap-3">
                        <span>Последняя версия</span>
                        <span>{project.latestVersionNumber ? `v${project.latestVersionNumber}` : "Нет версий"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Создан</span>
                        <span>{new Date(project.createdAt).toLocaleDateString("ru-RU")}</span>
                      </div>
                    </div>

                    {project.latestVersionId ? (
                      <Link
                        href={href}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm font-medium text-slate-50 transition hover:border-white/20 hover:bg-slate-950/70"
                      >
                        <FolderOpen className="h-4 w-4" />
                        Открыть review workspace
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm text-slate-400">
                        Для проекта ещё не загружены версии.
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}
      </div>
    </main>
  );
}
