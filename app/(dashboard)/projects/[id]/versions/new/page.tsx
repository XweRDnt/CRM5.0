"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VersionUploadFlow } from "@/components/versions/VersionUploadFlow";

export default function CreateVersionPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Добавить новую версию</CardTitle>
        </CardHeader>
        <CardContent>
          <VersionUploadFlow projectId={projectId} surface="page" />
        </CardContent>
      </Card>
    </div>
  );
}
