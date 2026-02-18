"use client";

import { useEffect, useMemo, useState } from "react";
import type { AssetVersionResponse } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VersionStatusBadge } from "@/components/versions/VersionStatusBadge";

type VersionStatus = AssetVersionResponse["status"];

const statusOptions: VersionStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "FINAL",
];

const statusLabelMap: Record<VersionStatus, string> = {
  DRAFT: "Черновик",
  IN_REVIEW: "На review",
  CHANGES_REQUESTED: "Есть правки",
  APPROVED: "Утверждена",
  FINAL: "Утверждена",
};

type VersionsListProps = {
  versions: AssetVersionResponse[];
  onChangeStatus?: (versionId: string, status: VersionStatus) => Promise<void> | void;
  onApprove?: (versionId: string) => Promise<void> | void;
  isLoading?: boolean;
};

export function VersionsList({ versions, onChangeStatus, onApprove, isLoading = false }: VersionsListProps): JSX.Element {
  const defaultSelections = useMemo(
    () => Object.fromEntries(versions.map((version) => [version.id, version.status])) as Record<string, VersionStatus>,
    [versions],
  );
  const [selectedStatuses, setSelectedStatuses] = useState<Record<string, VersionStatus>>(defaultSelections);
  const [pendingVersionId, setPendingVersionId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedStatuses(defaultSelections);
  }, [defaultSelections]);

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="h-24 p-6" />
      </Card>
    );
  }

  if (versions.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral-500">Пока нет загруженных версий.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {versions.map((version) => {
        const selected = selectedStatuses[version.id] ?? version.status;

        return (
          <Card key={version.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">Версия {version.versionNumber}</p>
                  <p className="text-sm text-neutral-500">{version.fileName}</p>
                </div>
                <VersionStatusBadge status={version.status} />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm"
                  aria-label={`Сменить статус версии ${version.versionNumber}`}
                  value={selected}
                  onChange={(event) => {
                    setSelectedStatuses((current) => ({
                      ...current,
                      [version.id]: event.target.value as VersionStatus,
                    }));
                  }}
                  disabled={pendingVersionId === version.id}
                >
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {statusLabelMap[option]}
                    </option>
                  ))}
                </select>

                <Button
                  variant="outline"
                  disabled={pendingVersionId === version.id || selected === version.status}
                  onClick={async () => {
                    if (!onChangeStatus) return;
                    setPendingVersionId(version.id);
                    try {
                      await onChangeStatus(version.id, selected);
                    } finally {
                      setPendingVersionId(null);
                    }
                  }}
                >
                  Сменить статус
                </Button>

                <Button
                  disabled={pendingVersionId === version.id || version.status !== "IN_REVIEW"}
                  onClick={async () => {
                    if (!onApprove) return;
                    setPendingVersionId(version.id);
                    try {
                      await onApprove(version.id);
                    } finally {
                      setPendingVersionId(null);
                    }
                  }}
                >
                  Утвердить
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
