"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as tus from "tus-js-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/utils/client-api";
import type { ConfirmUploadResponse, UploadUrlResponse } from "@/types";

type UploadStage = "idle" | "preparing" | "uploading" | "processing" | "done";

const POLL_INTERVAL_MS = 3000;
const MAX_CONFIRM_ATTEMPTS = 20;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadViaTus(endpoint: string, file: File): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint,
      retryDelays: [0, 1000, 3000, 5000],
      metadata: {
        filename: file.name,
        filetype: file.type || "application/octet-stream",
      },
      onError(error) {
        reject(error);
      },
      onSuccess() {
        resolve();
      },
    });

    upload.start();
  });
}

async function uploadToKinescope(session: UploadUrlResponse, file: File): Promise<void> {
  if (session.uploadMethod === "POST") {
    try {
      await uploadViaTus(session.uploadUrl, file);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      throw new Error(`Upload failed with Tus: ${message}`);
    }
    return;
  }

  const response = await fetch(session.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
      ...(session.uploadHeaders ?? {}),
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with code ${response.status}`);
  }
}

export default function CreateVersionPage(): JSX.Element {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [versionNo, setVersionNo] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [durationSec, setDurationSec] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [stage, setStage] = useState<UploadStage>("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!file) {
      setError("Выберите видеофайл для загрузки");
      return;
    }

    setError("");

    try {
      setStage("preparing");
      const uploadSession = await apiFetch<UploadUrlResponse>("/api/upload", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      setStage("uploading");
      await uploadToKinescope(uploadSession, file);

      setStage("processing");
      let confirm: ConfirmUploadResponse | null = null;
      for (let attempt = 0; attempt < MAX_CONFIRM_ATTEMPTS; attempt += 1) {
        confirm = await apiFetch<ConfirmUploadResponse>("/api/upload/confirm", {
          method: "POST",
          body: JSON.stringify({
            projectId,
            kinescopeVideoId: uploadSession.kinescopeVideoId,
          }),
        });

        if (confirm.processingStatus === "READY" || confirm.processingStatus === "FAILED") {
          break;
        }
        await sleep(POLL_INTERVAL_MS);
      }

      if (!confirm) {
        throw new Error("Не удалось подтвердить загрузку");
      }

      if (confirm.processingStatus === "FAILED") {
        throw new Error(confirm.processingError ?? "Обработка видео завершилась с ошибкой");
      }

      await apiFetch(`/api/projects/${projectId}/versions`, {
        method: "POST",
        body: JSON.stringify({
          versionNo,
          fileName: file.name,
          fileSize: file.size,
          durationSec: durationSec.trim() ? Number(durationSec) : confirm.durationSec ?? undefined,
          notes: notes.trim() || undefined,
          videoProvider: "KINESCOPE",
          kinescopeVideoId: confirm.kinescopeVideoId,
          streamUrl: confirm.streamUrl ?? undefined,
          fileUrl: confirm.streamUrl ?? `https://kinescope.io/${confirm.kinescopeVideoId}`,
          processingStatus: confirm.processingStatus,
          processingError: confirm.processingError ?? undefined,
        }),
      });

      setStage("done");
      router.push(`/projects/${projectId}/versions`);
    } catch (submitError) {
      setStage("idle");
      setError(submitError instanceof Error ? submitError.message : "Не удалось создать версию");
    }
  };

  const stageLabel: Record<UploadStage, string> = {
    idle: "Готово к загрузке",
    preparing: "Подготовка загрузки",
    uploading: "Загрузка файла",
    processing: "Обработка видео",
    done: "Готово",
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Добавить новую версию</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium">Номер версии</label>
              <Input min={1} required type="number" value={versionNo} onChange={(event) => setVersionNo(Number(event.target.value))} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Видео-файл</label>
              <Input
                required
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/avi"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <p className="mt-1 text-xs text-neutral-500">Поддерживаемые форматы: MP4, MOV, WEBM, AVI. Максимум 5GB.</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Длительность (сек, опционально)</label>
              <Input type="number" value={durationSec} onChange={(event) => setDurationSec(event.target.value)} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Заметки (опционально)</label>
              <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
              Статус: {stageLabel[stage]}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button className="w-full" disabled={stage !== "idle"} type="submit">
              {stage === "idle" ? "Загрузить и создать версию" : "Выполняется..."}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
