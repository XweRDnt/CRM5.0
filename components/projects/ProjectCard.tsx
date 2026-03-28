"use client";

import useSWR from "swr";
import { useRouter } from "next/navigation";
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
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

type ProjectCardProps = {
  project: ProjectResponse;
  latestVersionStatus?: VersionUiStatus;
  canDelete?: boolean;
  onDelete?: (projectId: string, projectName: string) => void;
};

export function ProjectCard({ project, latestVersionStatus, canDelete = false, onDelete }: ProjectCardProps): JSX.Element {
  const router = useRouter();
  const [deleteMenuPosition, setDeleteMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const deleteMenuRef = useRef<HTMLDivElement | null>(null);
  const suppressNextClickRef = useRef(false);
  const shouldHydrateStatus = latestVersionStatus === undefined && project.latestVersionStatus === undefined;
  const { data: versionsResponse } = useSWR(
    shouldHydrateStatus ? `/api/projects/${project.id}/versions` : null,
    apiFetch<ApiWrapped<AssetVersionResponse[]>>,
  );
  const { data: feedback = [] } = useSWR(
    shouldHydrateStatus ? `/api/projects/${project.id}/feedback` : null,
    apiFetch<FeedbackResponse[]>,
  );

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null;
      if (deleteMenuRef.current?.contains(target)) {
        return;
      }

      setDeleteMenuPosition(null);
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "Escape") {
        setDeleteMenuPosition(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };
  }, []);

  const versions = versionsResponse ? unwrap(versionsResponse) : [];
  const latestVersion = versions.length > 0 ? [...versions].sort((a, b) => b.versionNumber - a.versionNumber)[0] : undefined;
  const latestHasClientFeedback =
    latestVersion !== undefined &&
    feedback.some((item) => item.assetVersionId === latestVersion.id && item.authorType === "CLIENT");

  const initialUiStatus =
    project.latestVersionStatus !== undefined && project.latestVersionStatus !== null
      ? toVersionUiStatus(project.latestVersionStatus, project.latestVersionHasClientFeedback === true)
      : undefined;

  const uiStatus =
    latestVersionStatus ??
    initialUiStatus ??
    (latestVersion !== undefined
      ? toVersionUiStatus(latestVersion.status, latestHasClientFeedback)
      : mapProjectToVersionUiStatus(project.status));

  const openDeleteMenu = (x: number, y: number): void => {
    if (typeof window === "undefined") {
      setDeleteMenuPosition({ x, y });
      return;
    }

    setDeleteMenuPosition({
      x: Math.max(16, Math.min(x, window.innerWidth - 220)),
      y: Math.max(16, Math.min(y, window.innerHeight - 88)),
    });
  };

  const clearLongPressTimer = (): void => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleCardClick = (): void => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    router.push(`/projects/${project.id}`);
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCardClick();
    }
  };

  const handleCardContextMenu = (event: MouseEvent<HTMLDivElement>): void => {
    if (!canDelete) {
      return;
    }

    event.preventDefault();
    openDeleteMenu(event.clientX, event.clientY);
  };

  const handleCardPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!canDelete || event.pointerType === "mouse") {
      return;
    }

    clearLongPressTimer();
    const currentTarget = event.currentTarget;
    longPressTimerRef.current = window.setTimeout(() => {
      const rect = currentTarget.getBoundingClientRect();
      suppressNextClickRef.current = true;
      openDeleteMenu(rect.left + rect.width / 2, rect.bottom + 12);
      longPressTimerRef.current = null;
    }, 550);
  };

  return (
    <>
      <Card
        className="glass-card cursor-pointer transition hover:border-white/18 hover:bg-white/[0.04]"
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        onContextMenu={handleCardContextMenu}
        onPointerDown={handleCardPointerDown}
        onPointerUp={clearLongPressTimer}
        onPointerCancel={clearLongPressTimer}
        onPointerLeave={clearLongPressTimer}
      >
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>{project.name}</CardTitle>
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
          <span className="text-sm glass-muted">Создан: {new Date(project.createdAt).toLocaleDateString("ru-RU")}</span>
        </CardContent>
      </Card>

      {canDelete && deleteMenuPosition ? (
        <div
          ref={deleteMenuRef}
          className="fixed z-40 min-w-[180px] rounded-2xl border border-red-400/16 bg-[linear-gradient(180deg,rgba(18,20,31,0.98),rgba(10,12,20,0.98))] p-2 shadow-[0_18px_44px_rgba(0,0,0,0.35)] backdrop-blur-[20px]"
          style={{ left: deleteMenuPosition.x, top: deleteMenuPosition.y, transform: "translate(-50%, 0)" }}
        >
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start rounded-xl px-3 py-2.5 text-[13px] font-semibold text-red-200 hover:bg-red-950/30 hover:text-red-100"
            onClick={() => {
              setDeleteMenuPosition(null);
              onDelete?.(project.id, project.name);
            }}
          >
            Удалить
          </Button>
        </div>
      ) : null}
    </>
  );
}
