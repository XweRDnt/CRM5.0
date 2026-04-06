"use client";

import { useEffect, useMemo, useRef, useState, type DragEventHandler, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import * as tus from "tus-js-client";
import type { VideoProcessingStatus } from "@prisma/client";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/utils/client-api";
import { cn } from "@/lib/utils/cn";
import type { ConfirmUploadResponse, UploadUrlResponse, VersionMetaResponse } from "@/types";

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

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(1, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${secs.toString().padStart(2, "0")}`;
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

async function readVideoDurationSec(file: File): Promise<number> {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function" || typeof URL.revokeObjectURL !== "function") {
    throw new Error("Браузер не поддерживает чтение метаданных видео.");
  }

  return await new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);

    const cleanup = (): void => {
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      if (typeof video.load === "function") {
        video.load();
      }
      URL.revokeObjectURL(objectUrl);
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const durationSec = Math.ceil(video.duration);
      cleanup();

      if (!Number.isFinite(durationSec) || durationSec <= 0) {
        reject(new Error("Не удалось определить длительность видео. Выберите другой файл."));
        return;
      }

      resolve(durationSec);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Не удалось прочитать метаданные видео. Выберите другой файл."));
    };
    video.src = objectUrl;
  });
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
  const fileSelectionTokenRef = useRef(0);

  const [versionTitle, setVersionTitle] = useState("Версия 1");
  const [versionTitleTouchedByUser, setVersionTitleTouchedByUser] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileDurationSec, setSelectedFileDurationSec] = useState<number | null>(null);
  const [readingFileMetadata, setReadingFileMetadata] = useState(false);
  const [stage, setStage] = useState<UploadStage>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingAttempt, setProcessingAttempt] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [continueInBackgroundRequested, setContinueInBackgroundRequested] = useState(false);
  const [appTheme, setAppTheme] = useState<"light" | "dark">("light");

  const { data: meta, isLoading: metaLoading, mutate: mutateMeta } = useSWR(
    `/api/projects/${projectId}/versions/meta`,
    apiFetch<VersionMetaResponse>,
  );

  useEffect(() => {
    if (!meta || versionTitleTouchedByUser) {
      return;
    }
    setVersionTitle(`Версия ${meta.nextVersionNumber}`);
  }, [meta, versionTitleTouchedByUser]);

  useEffect(() => {
    return () => {
      activeUploadCancelRef.current?.();
      pollingAbortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    const readTheme = (): void => {
      setAppTheme(root.getAttribute("data-app-theme") === "dark" ? "dark" : "light");
    };

    readTheme();
    if (typeof MutationObserver !== "function") {
      return;
    }

    const observer = new MutationObserver(readTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-app-theme"] });
    return () => observer.disconnect();
  }, []);

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

  const applyFileSelection = async (file: File | null): Promise<void> => {
    fileSelectionTokenRef.current += 1;

    if (!file) {
      setSelectedFile(null);
      setSelectedFileDurationSec(null);
      setReadingFileMetadata(false);
      return;
    }

    const validationError = getFileValidationError(file);
    if (validationError) {
      setSelectedFile(null);
      setSelectedFileDurationSec(null);
      setReadingFileMetadata(false);
      setErrorMessage(validationError);
      return;
    }

    const token = fileSelectionTokenRef.current;
    setSelectedFile(file);
    setSelectedFileDurationSec(null);
    setReadingFileMetadata(true);
    setErrorMessage("");

    try {
      const durationSec = await readVideoDurationSec(file);
      if (fileSelectionTokenRef.current !== token) {
        return;
      }
      setSelectedFileDurationSec(durationSec);
    } catch (error) {
      if (fileSelectionTokenRef.current !== token) {
        return;
      }
      setSelectedFileDurationSec(null);
      setErrorMessage(error instanceof Error ? error.message : "Не удалось определить длительность видео.");
    } finally {
      if (fileSelectionTokenRef.current === token) {
        setReadingFileMetadata(false);
      }
    }
  };

  const resetTransientState = (): void => {
    setUploadProgress(0);
    setProcessingAttempt(0);
    setContinueInBackgroundRequested(false);
    continueInBackgroundRef.current = false;
    latestConfirmRef.current = null;
  };

  const handleVersionTitleChange = (nextValue: string): void => {
    setVersionTitleTouchedByUser(true);
    setVersionTitle(nextValue);
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

  const createVersionRecord = async (
    uploadSession: UploadUrlResponse,
    file: File,
    title: string,
    confirmResult: ConfirmUploadResponse | null,
  ): Promise<void> => {
    const resolvedStatus = normalizeProcessingStatus(confirmResult?.processingStatus);
    const kinescopeVideoId = confirmResult?.kinescopeVideoId ?? uploadSession.kinescopeVideoId;
    const streamUrl = confirmResult?.streamUrl ?? undefined;
    const fileUrl = streamUrl ?? `https://kinescope.io/${kinescopeVideoId}`;

    await apiFetch(`/api/projects/${projectId}/versions`, {
      method: "POST",
      body: JSON.stringify({
        title,
        fileName: file.name,
        fileSize: file.size,
        durationSec: confirmResult?.durationSec ?? selectedFileDurationSec ?? undefined,
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
    if (versionTitle.trim().length === 0) {
      setErrorMessage("Введите название версии.");
      return;
    }
    if (readingFileMetadata) {
      setErrorMessage("Подождите, пока мы определим длительность видео.");
      return;
    }
    if (selectedFileDurationSec === null) {
      setErrorMessage("Не удалось определить длительность видео. Выберите другой файл.");
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
          durationSec: selectedFileDurationSec,
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
      await createVersionRecord(uploadSession, selectedFile, versionTitle.trim(), confirmResult);
      await mutateMeta();
      setStage("done");
      onCompleted?.();
      router.replace(`/projects/${projectId}/versions`);
      router.refresh();
    } catch (submitError) {
      if (submitError instanceof UploadCanceledError) {
        setStage("canceled");
        setErrorMessage("Загрузка отменена. Нажмите «Повторить загрузку», чтобы попробовать снова.");
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

  const isLightTheme = surface === "page" && appTheme === "light";
  const inputClassName = isLightTheme
    ? "!border-neutral-300 !bg-white !text-neutral-900 !placeholder:text-neutral-400 focus:!ring-blue-500"
    : "!border-white/10 !bg-slate-950/80 !text-slate-100 !placeholder:text-slate-500 focus:!ring-blue-500";
  const outlineButtonClassName = isLightTheme
    ? "!border-neutral-300 !bg-white !text-neutral-700 hover:!bg-neutral-100"
    : "!border-white/10 !bg-white/[0.04] !text-slate-200 hover:!bg-white/[0.08]";
  const labelClassName = isLightTheme ? "text-neutral-700" : "text-neutral-300";
  const mutedTextClassName = isLightTheme ? "text-neutral-500" : "text-neutral-400";
  const bodyTextClassName = isLightTheme ? "text-neutral-700" : "text-neutral-300";
  const sectionCardClassName = isLightTheme
    ? "rounded-[24px] border border-neutral-200 bg-white/90 p-4 shadow-sm"
    : "rounded-[24px] border border-white/10 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl";
  const dropzoneClassName = cn(
    "version-upload-dropzone rounded-[28px] border border-dashed transition-colors",
    surface === "dialog" ? "min-h-[250px] p-5 sm:min-h-[270px] sm:p-5" : "min-h-[420px] p-6 sm:min-h-[480px] sm:p-8",
    isLightTheme ? "border-neutral-300 bg-white" : "border-white/10 bg-slate-950/35",
    isDragActive && (isLightTheme ? "version-upload-dropzone-active border-blue-500 bg-blue-50" : "version-upload-dropzone-active border-blue-400 bg-blue-500/10"),
  );
  const statusCardClassName = cn(
    "version-upload-status rounded-[22px] border px-4 py-3",
    isLightTheme ? "border-neutral-200 bg-white" : "border-white/10 bg-white/[0.03]",
  );

  const layoutClassName =
    surface === "dialog"
      ? "grid h-full min-h-0 gap-4 lg:grid-cols-[220px,minmax(0,1fr)]"
      : "space-y-5";

  const fieldsSection = (
    <div className={cn("space-y-2", sectionCardClassName, surface === "dialog" ? "p-3.5" : "")}>
        <label htmlFor={`versionTitle-${projectId}`} className={cn("block text-sm font-medium", labelClassName)}>
          Название версии
        </label>
        <Input
          id={`versionTitle-${projectId}`}
          className={cn(inputClassName, surface === "dialog" ? "h-11 rounded-2xl text-[15px]" : "")}
          value={versionTitle}
          onChange={(event) => handleVersionTitleChange(event.target.value)}
          disabled={isBusy || metaLoading}
          aria-invalid={versionTitle.trim().length === 0}
          aria-describedby={`versionTitleHelp-${projectId}`}
          placeholder="Версия 1"
        />
        {surface === "dialog" ? (
          <p id={`versionTitleHelp-${projectId}`} className="sr-only">
            По умолчанию подставляется следующая версия, но вы можете назвать её по-своему.
          </p>
        ) : (
          <p id={`versionTitleHelp-${projectId}`} className={cn("text-xs", mutedTextClassName)}>
            По умолчанию подставляется следующая версия, но вы можете назвать её по-своему.
          </p>
        )}
      </div>
  );

  const uploadSection = (
      <div className={cn("space-y-2", sectionCardClassName, surface === "dialog" ? "flex h-full min-h-0 flex-col p-3.5" : "")}>
        <div
          className={dropzoneClassName}
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
          <div className={cn("flex flex-col items-center justify-center gap-3 text-center", surface === "dialog" ? "min-h-[250px] flex-1 sm:min-h-[270px]" : "min-h-[360px] sm:min-h-[392px]")}>
            <div>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
                <UploadCloud className="h-6 w-6 text-blue-300" />
              </div>
              <p className={cn("text-[17px] font-semibold tracking-[-0.03em]", bodyTextClassName)}>Перетащите видео сюда</p>
              {selectedFile ? (
                <div className="mt-3 space-y-1">
                  <p className={cn("text-sm font-medium", isLightTheme ? "text-neutral-900" : "text-neutral-100")}>
                    {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                  <p className={cn("text-xs", mutedTextClassName)}>
                    {readingFileMetadata
                      ? "Определяем длительность видео..."
                      : selectedFileDurationSec !== null
                        ? `Длительность: ${formatDuration(selectedFileDurationSec)}`
                        : "Длительность не определена"}
                  </p>
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              className={cn("min-w-40 rounded-2xl", outlineButtonClassName)}
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
            >
              Выбрать файл
            </Button>
            <p className={cn("text-xs", mutedTextClassName)}>Форматы: MP4, MOV, WEBM, AVI. Максимум 5GB.</p>
          </div>
        </div>
      </div>
  );

  const statusSection = (
      <div className={cn(statusCardClassName, surface === "dialog" ? "px-3.5 py-3" : "")} aria-live="polite">
        <p className={cn("text-sm", bodyTextClassName)}>Статус: {statusLabel[stage]}</p>
        {progressValue !== null ? (
          <div className={cn("mt-2 h-2 rounded", isLightTheme ? "bg-neutral-200" : "bg-neutral-700")} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressValue}>
            <div className="h-2 rounded bg-blue-500 transition-all" style={{ width: `${progressValue}%` }} />
          </div>
        ) : null}
      </div>
  );

  const actionsSection = (
      <div className={cn("flex flex-col gap-2", surface === "dialog" ? "" : "sm:flex-row")}>
        {surface === "dialog" && onCancel ? (
          <Button type="button" variant="outline" className={cn("h-10 rounded-2xl", outlineButtonClassName)} onClick={onCancel} disabled={isBusy}>
            Закрыть
          </Button>
        ) : null}
        {stage === "uploading" ? (
          <Button type="button" variant="outline" className={cn("h-10 rounded-2xl", outlineButtonClassName)} onClick={handleCancelUpload}>
            Отменить загрузку
          </Button>
        ) : null}
        {stage === "processing" ? (
          <Button type="button" variant="outline" className={cn("h-10 rounded-2xl", outlineButtonClassName)} onClick={handleContinueInBackground} disabled={continueInBackgroundRequested}>
            Продолжить в фоне
          </Button>
        ) : null}
        <Button
          type="submit"
          className={cn("h-10 rounded-2xl", surface === "page" ? "w-full sm:w-auto" : "w-full")}
          disabled={!canSubmit || isBusy || !selectedFile || versionTitle.trim().length === 0 || readingFileMetadata || selectedFileDurationSec === null}
        >
          {primaryButtonLabel}
        </Button>
      </div>
  );

  if (surface === "dialog") {
    return (
      <form className={cn("version-upload-form min-h-0", layoutClassName)} onSubmit={handleSubmit}>
        <div className="flex min-h-0 flex-col gap-4">
          {fieldsSection}
          {statusSection}
          {errorMessage ? <p className={cn("px-1 text-sm", isLightTheme ? "text-red-600" : "text-red-400")}>{errorMessage}</p> : null}
          <div className="mt-auto">{actionsSection}</div>
        </div>
        <div className="min-h-0">{uploadSection}</div>
      </form>
    );
  }

  return (
    <form className={cn("version-upload-form", layoutClassName)} onSubmit={handleSubmit}>
      {fieldsSection}
      {uploadSection}
      {statusSection}
      {errorMessage ? <p className={cn("text-sm", isLightTheme ? "text-red-600" : "text-red-400")}>{errorMessage}</p> : null}
      {actionsSection}
    </form>
  );
}

