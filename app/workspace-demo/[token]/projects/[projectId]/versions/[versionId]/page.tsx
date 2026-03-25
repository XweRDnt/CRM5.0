import { notFound } from "next/navigation";
import { isWorkspaceDemoToken } from "@/lib/utils/workspace-demo-token";
import { WorkspaceDemoReviewPageClient } from "./workspace-demo-review-page-client";

export default async function WorkspaceDemoVersionPage({
  params,
}: {
  params: Promise<{ token: string; projectId: string; versionId: string }>;
}): Promise<JSX.Element> {
  const { token, projectId, versionId } = await params;

  if (!isWorkspaceDemoToken(token)) {
    notFound();
  }

  return <WorkspaceDemoReviewPageClient token={token} projectId={projectId} versionId={versionId} />;
}
