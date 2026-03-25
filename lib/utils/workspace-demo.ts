import { VersionStatus, type AssetVersion } from "@prisma/client";
import { prisma } from "@/lib/utils/db";

export function getWorkspaceDemoWorkspaceId(): string | null {
  const workspaceId = process.env.DEMO_WORKSPACE_ID?.trim();
  return workspaceId ? workspaceId : null;
}

export async function getWorkspaceDemoWorkspace() {
  const workspaceId = getWorkspaceDemoWorkspaceId();
  if (!workspaceId) {
    return null;
  }

  return prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      tenantId: true,
    },
  });
}

export function selectWorkspaceDemoActiveVersion(
  versions: AssetVersion[],
  requestedVersionId?: string,
): AssetVersion | null {
  if (versions.length === 0) {
    return null;
  }

  if (requestedVersionId) {
    const requested = versions.find((item) => item.id === requestedVersionId);
    if (requested) {
      return requested;
    }
  }

  const inReview = versions.find((item) => item.status === VersionStatus.IN_REVIEW);
  return inReview ?? versions[0];
}
