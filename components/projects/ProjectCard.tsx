"use client";

import Link from "next/link";
import useSWR from "swr";
import type { ProjectStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/utils/client-api";
import { cn } from "@/lib/utils/cn";
import { VERSION_STATUS_BADGE_CLASSES, VERSION_STATUS_LABELS, toVersionUiStatus, type VersionUiStatus } from "@/lib/constants/status-ui";
import type { AssetVersionResponse, FeedbackResponse, ProjectResponse } from "@/types";

type ApiWrapped<T> = T | { data: T };

function unwrap<T>(payload: ApiWrapped<T>): T {
  return "data" in (payload as { data?: T }) ? (payload as { data: T }).data : (payload as T);
}

function mapProjectToVersionUiStatus(projectStatus: ProjectStatus): VersionUiStatus {
  if (projectStatus === "CLIENT_REVIEW") return "IN_REVIEW";
  if (projectStatus === "ON_HOLD") return "CHANGES_REQUESTED";
  if (projectStatus === "COMPLETED") return "APPROVED";
  return "DRAFT";
}

export function ProjectCard({ project }: { project: ProjectResponse }): JSX.Element {
  const { data: versionsResponse } = useSWR(`/api/projects/${project.id}/versions`, apiFetch<ApiWrapped<AssetVersionResponse[]>>);
  const { data: feedback = [] } = useSWR(`/api/projects/${project.id}/feedback`, apiFetch<FeedbackResponse[]>);

  const versions = versionsResponse ? unwrap(versionsResponse) : [];
  const latestVersion = versions.length > 0 ? [...versions].sort((a, b) => b.versionNumber - a.versionNumber)[0] : undefined;
  const latestHasClientFeedback =
    latestVersion !== undefined &&
    feedback.some((item) => item.assetVersionId === latestVersion.id && item.authorType === "CLIENT");

  const uiStatus =
    latestVersion !== undefined
      ? toVersionUiStatus(latestVersion.status, latestHasClientFeedback)
      : mapProjectToVersionUiStatus(project.status);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{project.name}</CardTitle>
          <p className="mt-1 text-sm text-neutral-500">{project.client.name}</p>
        </div>
        <span
          className={cn(
            "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
            VERSION_STATUS_BADGE_CLASSES[uiStatus],
          )}
        >
          {VERSION_STATUS_LABELS[uiStatus]}
        </span>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <span className="text-sm text-neutral-500">Создан: {new Date(project.createdAt).toLocaleDateString("ru-RU")}</span>
        <Button asChild size="sm">
          <Link href={`/projects/${project.id}`}>Открыть</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
