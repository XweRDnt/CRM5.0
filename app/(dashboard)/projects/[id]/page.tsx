import Link from "next/link";
import { redirect } from "next/navigation";
import { VersionUploadDialog } from "@/components/versions/VersionUploadDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { assertProjectAccess } from "@/lib/services/access-control.service";
import { assetService } from "@/lib/services/asset.service";
import { requireServerSession } from "@/lib/server/session";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id: projectId } = await params;
  const session = await requireServerSession(`/projects/${projectId}`);
  await assertProjectAccess(session.payload, projectId);

  const versions = await assetService.listVersionsByProject(projectId, session.payload.tenantId);
  if (versions.length > 0) {
    const latest = [...versions].sort((a, b) => b.versionNumber - a.versionNumber)[0];
    redirect(`/projects/${projectId}/versions/${latest.id}`);
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-6">
        <p className="text-sm text-neutral-400">У проекта пока нет версий. Добавьте первую версию.</p>
        {session.user.isDemo ? null : <VersionUploadDialog projectId={projectId} triggerText="+ Добавить версию" />}
        <Button asChild variant="outline">
          <Link href="/projects">Вернуться к проектам</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
