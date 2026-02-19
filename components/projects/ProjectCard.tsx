"use client";

import Link from "next/link";
import useSWR from "swr";
import { type CSSProperties, useEffect, useState } from "react";
import type { ProjectStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/utils/client-api";
import { cn } from "@/lib/utils/cn";
import { VERSION_STATUS_BADGE_CLASSES, VERSION_STATUS_LABELS, toVersionUiStatus, type VersionUiStatus } from "@/lib/constants/status-ui";
import type { AssetVersionResponse, FeedbackResponse, ProjectResponse } from "@/types";

type ApiWrapped<T> = T | { data: T };
type AppTheme = "light" | "dark";

const STATUS_BADGE_STYLES: Record<AppTheme, Record<VersionUiStatus, CSSProperties>> = {
  light: {
    DRAFT: { borderColor: "#6b7280", backgroundColor: "#e5e7eb", color: "#111827" },
    IN_REVIEW: { borderColor: "#b45309", backgroundColor: "#fde68a", color: "#78350f" },
    CHANGES_REQUESTED: { borderColor: "#b91c1c", backgroundColor: "#fecaca", color: "#7f1d1d" },
    APPROVED: { borderColor: "#047857", backgroundColor: "#bbf7d0", color: "#064e3b" },
  },
  dark: {
    DRAFT: { borderColor: "#6b7280", backgroundColor: "rgba(55, 65, 81, 0.7)", color: "#f3f4f6" },
    IN_REVIEW: { borderColor: "#d97706", backgroundColor: "rgba(217, 119, 6, 0.25)", color: "#fde68a" },
    CHANGES_REQUESTED: { borderColor: "#dc2626", backgroundColor: "rgba(220, 38, 38, 0.25)", color: "#fecaca" },
    APPROVED: { borderColor: "#059669", backgroundColor: "rgba(5, 150, 105, 0.25)", color: "#bbf7d0" },
  },
};

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
  const [appTheme, setAppTheme] = useState<AppTheme>("light");
  const { data: versionsResponse } = useSWR(`/api/projects/${project.id}/versions`, apiFetch<ApiWrapped<AssetVersionResponse[]>>);
  const { data: feedback = [] } = useSWR(`/api/projects/${project.id}/feedback`, apiFetch<FeedbackResponse[]>);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    const readTheme = (): void => {
      setAppTheme(root.getAttribute("data-app-theme") === "dark" ? "dark" : "light");
    };

    readTheme();
    const observer = new MutationObserver(readTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-app-theme"] });
    return () => observer.disconnect();
  }, []);

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
    <Card className="border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900/50">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-neutral-900 dark:text-neutral-100">{project.name}</CardTitle>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{project.client.name}</p>
        </div>
        <span
          className={cn(
            "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
            VERSION_STATUS_BADGE_CLASSES[uiStatus],
          )}
          style={STATUS_BADGE_STYLES[appTheme][uiStatus]}
        >
          {VERSION_STATUS_LABELS[uiStatus]}
        </span>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <span className="text-sm text-neutral-600 dark:text-neutral-500">Создан: {new Date(project.createdAt).toLocaleDateString("ru-RU")}</span>
        <Button asChild size="sm">
          <Link href={`/projects/${project.id}`}>Открыть</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
