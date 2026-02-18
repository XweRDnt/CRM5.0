"use client";

import Link from "next/link";
import useSWR from "swr";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/utils/client-api";
import type { AssetVersionResponse } from "@/types";

const fetcher = (url: string) => apiFetch<AssetVersionResponse[]>(url);

export default function ProjectVersionsPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;
  const { data, isLoading, error } = useSWR(`/api/projects/${projectId}/versions`, fetcher);

  useEffect(() => {
    if (!data || data.length === 0) {
      return;
    }

    const latest = [...data].sort((a, b) => b.versionNumber - a.versionNumber)[0];
    if (latest) {
      router.replace(`/projects/${projectId}/versions/${latest.id}`);
    }
  }, [data, projectId, router]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="space-y-3 py-6">
          <p className="text-sm text-red-500">Не удалось загрузить версии проекта.</p>
          <Button asChild variant="outline">
            <Link href={`/projects/${projectId}`}>Вернуться в проект</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 py-6">
          <p className="text-sm text-neutral-400">Пока нет версий. Добавьте первую версию.</p>
          <Button asChild>
            <Link href={`/projects/${projectId}/versions/new`}>+ Добавить версию</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-10">
        <div className="flex items-center justify-center gap-2 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          Открываю последнюю версию...
        </div>
      </CardContent>
    </Card>
  );
}
