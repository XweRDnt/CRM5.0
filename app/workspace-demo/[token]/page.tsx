import { notFound } from "next/navigation";
import { isWorkspaceDemoToken } from "@/lib/utils/workspace-demo-token";
import { WorkspaceDemoProjectsPageClient } from "./workspace-demo-projects-page-client";

export default async function WorkspaceDemoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<JSX.Element> {
  const { token } = await params;

  if (!isWorkspaceDemoToken(token)) {
    notFound();
  }

  return <WorkspaceDemoProjectsPageClient token={token} />;
}
