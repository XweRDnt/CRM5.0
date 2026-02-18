"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/utils/client-api";

type SourceMode = "file" | "youtube";

export default function CreateVersionPage(): JSX.Element {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [sourceMode, setSourceMode] = useState<SourceMode>("file");
  const [versionNo, setVersionNo] = useState(1);
  const [fileUrl, setFileUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(10_485_760);
  const [durationSec, setDurationSec] = useState<string>("120");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const resolvedUrl = sourceMode === "youtube" ? youtubeUrl.trim() : fileUrl.trim();
      const resolvedFileName = fileName.trim() || (sourceMode === "youtube" ? `youtube-v${versionNo}` : `version-v${versionNo}`);
      const resolvedFileSize = sourceMode === "youtube" ? 1 : fileSize;

      await apiFetch(`/api/projects/${projectId}/versions`, {
        method: "POST",
        body: JSON.stringify({
          versionNo,
          fileUrl: resolvedUrl,
          fileName: resolvedFileName,
          fileSize: resolvedFileSize,
          durationSec: durationSec.trim() ? Number(durationSec) : undefined,
          notes: notes.trim() || undefined,
        }),
      });

      router.push(`/projects/${projectId}/versions`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось создать версию");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Добавить новую версию</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={sourceMode === "file" ? "default" : "outline"} onClick={() => setSourceMode("file")}>
                Загрузить файл
              </Button>
              <Button
                type="button"
                variant={sourceMode === "youtube" ? "default" : "outline"}
                onClick={() => setSourceMode("youtube")}
              >
                Вставить ссылку YouTube
              </Button>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Номер версии</label>
              <Input min={1} required type="number" value={versionNo} onChange={(event) => setVersionNo(Number(event.target.value))} />
            </div>

            {sourceMode === "file" ? (
              <div>
                <label className="mb-1 block text-sm font-medium">Ссылка на видеофайл</label>
                <Input
                  required
                  type="url"
                  placeholder="https://cdn.example.com/video-v2.mp4"
                  value={fileUrl}
                  onChange={(event) => setFileUrl(event.target.value)}
                />
                <p className="mt-1 text-xs text-neutral-500">Для MVP укажите доступный URL файла.</p>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium">Ссылка YouTube</label>
                <Input
                  required
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(event) => setYoutubeUrl(event.target.value)}
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium">Название версии</label>
              <Input
                required
                type="text"
                placeholder={sourceMode === "youtube" ? "youtube-v2" : "promo-v2.mp4"}
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
              />
            </div>

            {sourceMode === "file" && (
              <div>
                <label className="mb-1 block text-sm font-medium">Размер файла (байт)</label>
                <Input required type="number" value={fileSize} onChange={(event) => setFileSize(Number(event.target.value))} />
                <p className="mt-1 text-xs text-neutral-500">Пример: 10485760 = 10MB</p>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium">Длительность (сек, опционально)</label>
              <Input type="number" value={durationSec} onChange={(event) => setDurationSec(event.target.value)} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Заметки (опционально)</label>
              <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Создание..." : "Создать версию"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

