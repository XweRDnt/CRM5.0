import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { VERSION_STATUS_BADGE_CLASSES, VERSION_STATUS_LABELS, toVersionUiStatus } from "@/lib/constants/status-ui";
import type { AssetVersionResponse } from "@/types";

type VersionStatus = AssetVersionResponse["status"];

type VersionStatusBadgeProps = {
  status: VersionStatus;
  hasClientFeedback?: boolean;
  className?: string;
};

export function VersionStatusBadge({ status, hasClientFeedback = false, className }: VersionStatusBadgeProps): JSX.Element {
  const uiStatus = toVersionUiStatus(status, hasClientFeedback);

  return (
    <Badge className={cn("border", VERSION_STATUS_BADGE_CLASSES[uiStatus], className)} variant="secondary">
      {VERSION_STATUS_LABELS[uiStatus]}
    </Badge>
  );
}
