import type { ProjectStatus } from "@prisma/client";
import { cn } from "@/lib/utils/cn";
import { VERSION_STATUS_BADGE_CLASSES, VERSION_STATUS_LABELS, type VersionUiStatus } from "@/lib/constants/status-ui";

function mapProjectToVersionUiStatus(projectStatus: ProjectStatus): VersionUiStatus {
  if (projectStatus === "CLIENT_REVIEW") return "IN_REVIEW";
  if (projectStatus === "ON_HOLD") return "CHANGES_REQUESTED";
  if (projectStatus === "COMPLETED") return "APPROVED";
  return "DRAFT";
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }): JSX.Element {
  const uiStatus = mapProjectToVersionUiStatus(status);

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
        VERSION_STATUS_BADGE_CLASSES[uiStatus],
      )}
    >
      {VERSION_STATUS_LABELS[uiStatus]}
    </span>
  );
}
