"use client";

import { useEffect, useMemo, useRef, useState, type DragEventHandler, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import * as tus from "tus-js-client";
import type { VideoProcessingStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiRequestError } from "@/lib/utils/client-api";
import { cn } from "@/lib/utils/cn";
import type { ConfirmUploadResponse, UploadUrlResponse, VersionConflictResponse, VersionMetaResponse } from "@/types";

type UploadStage = "idle" | "preparing" | "uploading" | "processing" | "submitting" | "done" | "canceled";

type UploadSurface = "page" | "dialog";

type VersionUploadFlowProps = {
  projectId: string;
  surface?: UploadSurface;
  onCancel?: () => void;
  onCompleted?: () => void;
};

type UploadTask = {
  cancel: () => void;
  promise: Promise<void>;
};

const POLL_INTERVAL_MS = 3000;
const MAX_CONFIRM_ATTEMPTS = 20;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024;
const ACCEPT_ATTRIBUTE = "video/mp4,video/quicktime,video/webm,video/avi,video/x-msvideo";
const ACCEPTED_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm", "video/avi", "video/x-msvideo"]);

class UploadCanceledError extends Error {
  constructor() {
    super("Upload canceled");
    this.name = "UploadCanceledError";
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function suggestNextAvailableVersion(usedVersionNumbers: Set<number>, startFrom: number): number {
  let candidate = Math.max(1, startFrom);
  while (usedVersionNumbers.has(candidate)) {
    candidate += 1;
  }
  return candidate;
}

function normalizeProcessingStatus(status: VideoProcessingStatus | undefined): VideoProcessingStatus {
  if (status === "UPLOADING" || status === "PROCESSING" || status === "READY" || status === "FAILED") {
    return status;
  }
  return "PROCESSING";
}

function getFileValidationError(file: File): string | null {
  if (file.size <= 0) {
    return "Файл пустой. Выберите корректный видеофайл.";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Файл слишком большой. Максимальный размер 5GB.";
  }
  if (file.type && !ACCEPTED_TYPES.has(file.type)) {
    return "Неподдерживаемый формат. Доступны MP4, MOV, WEBM и AVI.";
  }
  return null;
}

function createTusUploadTask(
  uploadUrl: string,
  file: File,
  headers: Record<string, string> | undefined,
  onProgress: (percent: number) => void,
): UploadTask {
  let rejectPromise: ((reason?: unknown) => void) | null = null;
  let settled = false;
  let activeUpload: tus.Upload | null = null;

  const promise = new Promise<void>((resolve, reject) => {
    rejectPromise = reject;
    activeUpload = new tus.Upload(file, {
      uploadUrl,
      retryDelays: [0, 1000, 3000, 5000],
      headers,
      metadata: {
        filename: file.name,
        filetype: file.type || "application/octet-stream",
      },
      onError(error) {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      },
      onSuccess() {
        if (settled) {
          return;
        }
        settled = true;
        onProgress(100);
        resolve();
      },
      onProgress(bytesUploaded, bytesTotal) {
        if (bytesTotal > 0) {
          onProgress(Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100)));
        }
      },
    });

    activeUpload.start();
  });

  return {
    promise,
    cancel() {
      if (settled) {
        return;
      }
      settled = true;
      if (activeUpload) {
        void activeUpload.abort(true);
      }
      rejectPromise?.(new UploadCanceledError());
    },
  };
}

function createPutUploadTask(
  uploadUrl: string,
  file: File,
  headers: Record<string, string> | undefined,
  onProgress: (percent: number) => void,
): UploadTask {
  const controller = new AbortController();

  const promise = (async () => {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
        ...(headers ?? {}),
      },
      body: file,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Upload failed with code ${response.status}`);
    }
    onProgress(100);
  })();

  return {
    promise,
    cancel() {
      controller.abort();
    },
  };
}

function createUploadTask(session: UploadUrlResponse, file: File, onProgress: (percent: number) => void): UploadTask {
  if (session.uploadMethod === "POST") {
    return createTusUploadTask(session.uploadUrl, file, session.uploadHeaders, onProgress);
  }

  return createPutUploadTask(session.uploadUrl, file, session.uploadHeaders, onProgress);
}

async function sleepWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    const timeoutId = setTimeout(() => resolve(), ms);
    const onAbort = () => {
      clearTimeout(timeoutId);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function VersionUploadFlow({
  projectId,
  surface = "dialog",
  onCancel,
  onCompleted,
}: VersionUploadFlowProps): JSX.Element {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeUploadCancelRef = useRef<(() => void) | null>(null);
  const pollingAbortControllerRef = useRef<AbortController | null>(null);
  const continueInBackgroundRef = useRef(false);
  const latestConfirmRef = useRef<ConfirmUploadResponse | null>(null);

  const [versionNoValue, setVersionNoValue] = useState("1");
  const [versionTouchedByUser, setVersionTouchedByUser] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [stage, setStage] = useState<UploadStage>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingAttempt, setProcessingAttempt] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [conflictSuggestion, setConflictSuggestion] = useState<number | null>(null);
  const [continueInBackgroundRequested, setContinueInBackgroundRequested] = useState(false);

  const { data: meta, isLoading: metaLoading, mutate: mutateMeta } = useSWR(
    `/api/projects/${projectId}/versions/meta`,
    apiFetch<VersionMetaResponse>,
  );

  useEffect(() => {
    if (!meta || versionTouchedByUser) {
      return;
    }
    setVersionNoValue(String(meta.nextVersionNumber));
  }, [meta, versionTouchedByUser]);

  useEffect(() => {
    return () => {
      activeUploadCancelRef.current?.();
      pollingAbortControllerRef.current?.abort();
    };
  }, []);

  const usedVersionNumbers = useMemo(() => new Set(meta?.usedVersionNumbers ?? []), [meta]);

  const parsedVersionNo = Number(versionNoValue);
  const isVersionNoValid = Number.isInteger(parsedVersionNo) && parsedVersionNo > 0;
  const isLocalVersionConflict = isVersionNoValid && usedVersionNumbers.has(parsedVersionNo);

  const suggestedVersionNo = useMemo(() => {
    return suggestNextAvailableVersion(
      usedVersionNumbers,
      Math.max(meta?.nextVersionNumber ?? 1, isVersionNoValid ? parsedVersionNo + 1 : 1),
    );
  }, [meta?.nextVersionNumber, parsedVersionNo, isVersionNoValid, usedVersionNumbers]);

  const activeConflictSuggestion = conflictSuggestion ?? (isLocalVersionConflict ? suggestedVersionNo : null);
  const hasVersionConflict = activeConflictSuggestion !== null && activeConflictSuggestion !== parsedVersionNo;
  const isBusy = stage === "preparing" || stage === "uploading" || stage === "processing" || stage === "submitting";
  const canSubmit = stage === "idle" || stage === "canceled";

  const statusLabel: Record<UploadStage, string> = {
    idle: "Готово к загрузке",
    preparing: "Подготавливаем загрузку",
    uploading: `Загрузка файла ${uploadProgress}%`,
    processing: continueInBackgroundRequested
      ? "Готовим создание версии в фоновом режиме..."
      : `Ожидание обработки видео ${processingAttempt}/${MAX_CONFIRM_ATTEMPTS}`,
    submitting: "Создаём версию",
    done: "Готово",
    canceled: "Загрузка отменена. Можно повторить.",
  };

  const progressValue = useMemo(() => {
    if (stage === "uploading") {
      return uploadProgress;
    }
    if (stage === "processing") {
      return Math.min(100, Math.round((processingAttempt / MAX_CONFIRM_ATTEMPTS) * 100));
    }
    if (stage === "submitting") {
      return 100;
    }
    return null;
  }, [stage, uploadProgress, processingAttempt]);

  const applyFileSelection = (file: File | null): void => {
    if (!file) {
      return;
    }

    const validationError = getFileValidationError(file);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSelectedFile(file);
    setErrorMessage("");
  };

  const resetTransientState = (): void => {
    setUploadProgress(0);
    setProcessingAttempt(0);
    setContinueInBackgroundRequested(false);
    continueInBackgroundRef.current = false;
    latestConfirmRef.current = null;
  };

  const handleVersionNoChange = (nextValue: string): void => {
    setVersionTouchedByUser(true);
    setVersionNoValue(nextValue);
    setConflictSuggestion(null);
    setErrorMessage("");
  };

  const handleDrop: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setIsDragActive(false);
    applyFileSelection(event.dataTransfer.files?.[0] ?? null);
  };

  const handleDragOver: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const handleCancelUpload = (): void => {
    activeUploadCancelRef.current?.();
  };

  const handleContinueInBackground = (): void => {
    continueInBackgroundRef.current = true;
    setContinueInBackgroundRequested(true);
    pollingAbortControllerRef.current?.abort();
  };

  const applySuggestedVersion = (): void => {
    if (activeConflictSuggestion === null) {
      return;
    }
    setVersionTouchedByUser(true);
    setVersionNoValue(String(activeConflictSuggestion));
    setConflictSuggestion(null);
    setErrorMessage("");
  };

  const createVersionRecord = async (
    uploadSession: UploadUrlResponse,
    file: File,
    versionNo: number,
    confirmResult: ConfirmUploadResponse | null,
  ): Promise<void> => {
    const resolvedStatus = normalizeProcessingStatus(confirmResult?.processingStatus);
    const kinescopeVideoId = confirmResult?.kinescopeVideoId ?? uploadSession.kinescopeVideoId;
    const streamUrl = confirmResult?.streamUrl ?? undefined;
    const fileUrl = streamUrl ?? `https://kinescope.io/${kinescopeVideoId}`;

    await apiFetch(`/api/projects/${projectId}/versions`, {
      method: "POST",
      body: JSON.stringify({
        versionNo,
        fileName: file.name,
        fileSize: file.size,
        durationSec: confirmResult?.durationSec ?? undefined,
        videoProvider: "KINESCOPE",
        kinescopeVideoId,
        streamUrl,
        fileUrl,
        processingStatus: resolvedStatus,
        processingError: confirmResult?.processingError ?? undefined,
      }),
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage("Выберите видеофайл для загрузки.");
      return;
    }
    if (!isVersionNoValid) {
      setErrorMessage("Укажите корректный номер версии.");
      return;
    }
    if (hasVersionConflict) {
      setErrorMessage("Версия с таким номером уже существует.");
      return;
    }
    if (!canSubmit) {
      return;
    }

    resetTransientState();
    setErrorMessage("");

    try {
      setStage("preparing");
      const uploadSession = await apiFetch<UploadUrlResponse>("/api/upload", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          fileName: selectedFile.name,
          fileType: selectedFile.type || "application/octet-stream",
          fileSize: selectedFile.size,
        }),
      });

      setStage("uploading");
      const uploadTask = createUploadTask(uploadSession, selectedFile, setUploadProgress);
      activeUploadCancelRef.current = uploadTask.cancel;
      try {
        await uploadTask.promise;
      } catch (uploadError) {
        if (uploadError instanceof DOMException && uploadError.name === "AbortError") {
          throw new UploadCanceledError();
        }
        throw uploadError;
      } finally {
        activeUploadCancelRef.current = null;
      }

      setStage("processing");
      const pollingController = new AbortController();
      pollingAbortControllerRef.current = pollingController;

      for (let attempt = 0; attempt < MAX_CONFIRM_ATTEMPTS; attempt += 1) {
        if (continueInBackgroundRef.current) {
          break;
        }

        setProcessingAttempt(attempt + 1);
        const confirm = await apiFetch<ConfirmUploadResponse>("/api/upload/confirm", {
          method: "POST",
          body: JSON.stringify({
            projectId,
            kinescopeVideoId: uploadSession.kinescopeVideoId,
          }),
        });

        latestConfirmRef.current = confirm;

        if (confirm.processingStatus === "READY" || confirm.processingStatus === "FAILED") {
          break;
        }

        await sleepWithAbort(POLL_INTERVAL_MS, pollingController.signal);
      }

      const confirmResult = latestConfirmRef.current;
      if (confirmResult?.processingStatus === "FAILED") {
        throw new Error(confirmResult.processingError ?? "Обработка видео завершилась с ошибкой.");
      }

      setStage("submitting");
      await createVersionRecord(uploadSession, selectedFile, parsedVersionNo, confirmResult);
      await mutateMeta();
      setStage("done");
      onCompleted?.();
      router.replace(`/projects/${projectId}/versions`);
      router.refresh();
    } catch (submitError) {
      if (submitError instanceof UploadCanceledError) {
        setStage("canceled");
        setErrorMessage("Загрузка отменена. Нажмите «Повторить загрузку», чтобы попробовать снова.");
      } else if (submitError instanceof ApiRequestError && submitError.status === 409) {
        const payload = submitError.payload as VersionConflictResponse | undefined;
        setConflictSuggestion(typeof payload?.suggestedVersionNo === "number" ? payload.suggestedVersionNo : null);
        setErrorMessage("Версия с таким номером уже существует.");
        await mutateMeta();
        setStage("idle");
      } else {
        setStage("idle");
        setErrorMessage(submitError instanceof Error ? submitError.message : "Не удалось загрузить версию.");
      }
    } finally {
      activeUploadCancelRef.current = null;
      pollingAbortControllerRef.current?.abort();
      pollingAbortControllerRef.current = null;
      continueInBackgroundRef.current = false;
      setContinueInBackgroundRequested(false);
    }
  };

  const primaryButtonLabel = stage === "canceled" ? "Повторить загрузку" : "Загрузить версию";

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label htmlFor={`versionNo-${projectId}`} className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
          Номер версии
        </label>
        <Input
          id={`versionNo-${projectId}`}
          min={1}
          type="number"
          inputMode="numeric"
          value={versionNoValue}
          onChange={(event) => handleVersionNoChange(event.target.value)}
          disabled={isBusy || metaLoading}
          aria-invalid={!isVersionNoValid || hasVersionConflict}
          aria-describedby={`versionNoHelp-${projectId} versionNoError-${projectId}`}
        />
        <p id={`versionNoHelp-${projectId}`} className="text-xs text-neutral-500 dark:text-neutral-400">
          Подставляется автоматически, но вы можете изменить вручную.
        </p>
        {hasVersionConflict ? (
          <div
            id={`versionNoError-${projectId}`}
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <p>Этот номер уже используется.</p>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={applySuggestedVersion}>
              Применить v{activeConflictSuggestion}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">Видеофайл</label>
        <div
          className={cn(
            "rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 transition-colors dark:border-neutral-700 dark:bg-neutral-900/40",
            isDragActive && "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/20",
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            onChange={(event) => applyFileSelection(event.target.files?.[0] ?? null)}
            disabled={isBusy}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-neutral-700 dark:text-neutral-300">Перетащите файл сюда или выберите его вручную.</p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Форматы: MP4, MOV, WEBM, AVI. Максимум 5GB.</p>
              {selectedFile ? (
                <p className="mt-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              ) : null}
            </div>
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isBusy}>
              Выбрать файл
            </Button>
          </div>
        </div>
      </div>

      <div
        className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900/40"
        aria-live="polite"
      >
        <p className="text-sm text-neutral-700 dark:text-neutral-300">Статус: {statusLabel[stage]}</p>
        {progressValue !== null ? (
          <div className="mt-2 h-2 rounded bg-neutral-200 dark:bg-neutral-700" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressValue}>
            <div className="h-2 rounded bg-blue-500 transition-all" style={{ width: `${progressValue}%` }} />
          </div>
        ) : null}
      </div>

      {errorMessage ? <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p> : null}

      <div className={cn("flex flex-col gap-2", surface === "dialog" ? "sm:flex-row sm:justify-end" : "sm:flex-row")}>
        {surface === "dialog" && onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isBusy}>
            Закрыть
          </Button>
        ) : null}
        {stage === "uploading" ? (
          <Button type="button" variant="outline" onClick={handleCancelUpload}>
            Отменить загрузку
          </Button>
        ) : null}
        {stage === "processing" ? (
          <Button type="button" variant="outline" onClick={handleContinueInBackground} disabled={continueInBackgroundRequested}>
            Продолжить в фоне
          </Button>
        ) : null}
        <Button type="submit" className={cn(surface === "page" ? "w-full sm:w-auto" : "")} disabled={!canSubmit || isBusy || !selectedFile || !isVersionNoValid || hasVersionConflict}>
          {primaryButtonLabel}
        </Button>
      </div>
    </form>
  );
}
