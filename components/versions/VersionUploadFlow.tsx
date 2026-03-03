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
    return "Р¤Р°Р№Р» РїСѓСЃС‚РѕР№. Р’С‹Р±РµСЂРёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ РІРёРґРµРѕС„Р°Р№Р».";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Р¤Р°Р№Р» СЃР»РёС€РєРѕРј Р±РѕР»СЊС€РѕР№. РњР°РєСЃРёРјР°Р»СЊРЅС‹Р№ СЂР°Р·РјРµСЂ 5GB.";
  }
  if (file.type && !ACCEPTED_TYPES.has(file.type)) {
    return "РќРµРїРѕРґРґРµСЂР¶РёРІР°РµРјС‹Р№ С„РѕСЂРјР°С‚. Р”РѕСЃС‚СѓРїРЅС‹ MP4, MOV, WEBM Рё AVI.";
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
  const [appTheme, setAppTheme] = useState<"light" | "dark">("light");

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

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    const readTheme = (): void => {
      setAppTheme(root.getAttribute("data-app-theme") === "dark" ? "dark" : "light");
    };

    readTheme();
    const observer = new MutationObserver(readTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-app-theme"] });
    return () => observer.disconnect();
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
    idle: "Р“РѕС‚РѕРІРѕ Рє Р·Р°РіСЂСѓР·РєРµ",
    preparing: "РџРѕРґРіРѕС‚Р°РІР»РёРІР°РµРј Р·Р°РіСЂСѓР·РєСѓ",
    uploading: `Р—Р°РіСЂСѓР·РєР° С„Р°Р№Р»Р° ${uploadProgress}%`,
    processing: continueInBackgroundRequested
      ? "Р“РѕС‚РѕРІРёРј СЃРѕР·РґР°РЅРёРµ РІРµСЂСЃРёРё РІ С„РѕРЅРѕРІРѕРј СЂРµР¶РёРјРµ..."
      : `РћР¶РёРґР°РЅРёРµ РѕР±СЂР°Р±РѕС‚РєРё РІРёРґРµРѕ ${processingAttempt}/${MAX_CONFIRM_ATTEMPTS}`,
    submitting: "РЎРѕР·РґР°С‘Рј РІРµСЂСЃРёСЋ",
    done: "Р“РѕС‚РѕРІРѕ",
    canceled: "Р—Р°РіСЂСѓР·РєР° РѕС‚РјРµРЅРµРЅР°. РњРѕР¶РЅРѕ РїРѕРІС‚РѕСЂРёС‚СЊ.",
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
      setErrorMessage("Р’С‹Р±РµСЂРёС‚Рµ РІРёРґРµРѕС„Р°Р№Р» РґР»СЏ Р·Р°РіСЂСѓР·РєРё.");
      return;
    }
    if (!isVersionNoValid) {
      setErrorMessage("РЈРєР°Р¶РёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ РЅРѕРјРµСЂ РІРµСЂСЃРёРё.");
      return;
    }
    if (hasVersionConflict) {
      setErrorMessage("Р’РµСЂСЃРёСЏ СЃ С‚Р°РєРёРј РЅРѕРјРµСЂРѕРј СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚.");
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
        throw new Error(confirmResult.processingError ?? "РћР±СЂР°Р±РѕС‚РєР° РІРёРґРµРѕ Р·Р°РІРµСЂС€РёР»Р°СЃСЊ СЃ РѕС€РёР±РєРѕР№.");
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
        setErrorMessage("Р—Р°РіСЂСѓР·РєР° РѕС‚РјРµРЅРµРЅР°. РќР°Р¶РјРёС‚Рµ В«РџРѕРІС‚РѕСЂРёС‚СЊ Р·Р°РіСЂСѓР·РєСѓВ», С‡С‚РѕР±С‹ РїРѕРїСЂРѕР±РѕРІР°С‚СЊ СЃРЅРѕРІР°.");
      } else if (submitError instanceof ApiRequestError && submitError.status === 409) {
        const payload = submitError.payload as VersionConflictResponse | undefined;
        setConflictSuggestion(typeof payload?.suggestedVersionNo === "number" ? payload.suggestedVersionNo : null);
        setErrorMessage("Р’РµСЂСЃРёСЏ СЃ С‚Р°РєРёРј РЅРѕРјРµСЂРѕРј СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚.");
        await mutateMeta();
        setStage("idle");
      } else {
        setStage("idle");
        setErrorMessage(submitError instanceof Error ? submitError.message : "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РІРµСЂСЃРёСЋ.");
      }
    } finally {
      activeUploadCancelRef.current = null;
      pollingAbortControllerRef.current?.abort();
      pollingAbortControllerRef.current = null;
      continueInBackgroundRef.current = false;
      setContinueInBackgroundRequested(false);
    }
  };

  const primaryButtonLabel = stage === "canceled" ? "РџРѕРІС‚РѕСЂРёС‚СЊ Р·Р°РіСЂСѓР·РєСѓ" : "Р—Р°РіСЂСѓР·РёС‚СЊ РІРµСЂСЃРёСЋ";

  const isLightTheme = appTheme === "light";
  const inputClassName = isLightTheme
    ? "!border-neutral-300 !bg-white !text-neutral-900 !placeholder:text-neutral-400 focus:!ring-blue-500"
    : "!border-slate-700 !bg-slate-900/90 !text-slate-100 !placeholder:text-slate-500 focus:!ring-blue-500";
  const outlineButtonClassName = isLightTheme
    ? "!border-neutral-300 !bg-white !text-neutral-700 hover:!bg-neutral-100"
    : "!border-slate-700 !bg-slate-900/90 !text-slate-200 hover:!bg-slate-800";
  const labelClassName = isLightTheme ? "text-neutral-700" : "text-neutral-300";
  const mutedTextClassName = isLightTheme ? "text-neutral-500" : "text-neutral-400";
  const bodyTextClassName = isLightTheme ? "text-neutral-700" : "text-neutral-300";

  return (
    <form className="version-upload-form space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label htmlFor={`versionNo-${projectId}`} className={cn("block text-sm font-medium", labelClassName)}>
          РќРѕРјРµСЂ РІРµСЂСЃРёРё
        </label>
        <Input
          id={`versionNo-${projectId}`}
          min={1}
          type="number"
          inputMode="numeric"
          className={inputClassName}
          value={versionNoValue}
          onChange={(event) => handleVersionNoChange(event.target.value)}
          disabled={isBusy || metaLoading}
          aria-invalid={!isVersionNoValid || hasVersionConflict}
          aria-describedby={`versionNoHelp-${projectId} versionNoError-${projectId}`}
        />
        <p id={`versionNoHelp-${projectId}`} className={cn("text-xs", mutedTextClassName)}>
          РџРѕРґСЃС‚Р°РІР»СЏРµС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё, РЅРѕ РІС‹ РјРѕР¶РµС‚Рµ РёР·РјРµРЅРёС‚СЊ РІСЂСѓС‡РЅСѓСЋ.
        </p>
        {hasVersionConflict ? (
          <div
            id={`versionNoError-${projectId}`}
            className={cn(
              "version-upload-conflict rounded-md border px-3 py-2 text-sm",
              isLightTheme ? "border-amber-300 bg-amber-50 text-amber-900" : "border-amber-500/40 bg-amber-950/30 text-amber-200",
            )}
          >
            <p>Р­С‚РѕС‚ РЅРѕРјРµСЂ СѓР¶Рµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ.</p>
            <Button type="button" variant="outline" size="sm" className={cn("mt-2", outlineButtonClassName)} onClick={applySuggestedVersion}>
              РџСЂРёРјРµРЅРёС‚СЊ v{activeConflictSuggestion}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className={cn("block text-sm font-medium", labelClassName)}>Р’РёРґРµРѕС„Р°Р№Р»</label>
        <div
          className={cn(
            "version-upload-dropzone rounded-lg border border-dashed p-4 transition-colors",
            isLightTheme ? "border-neutral-300 bg-white" : "border-neutral-700 bg-neutral-900/40",
            isDragActive && (isLightTheme ? "version-upload-dropzone-active border-blue-500 bg-blue-50" : "version-upload-dropzone-active border-blue-400 bg-blue-950/20"),
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
              <p className={cn("text-sm", bodyTextClassName)}>РџРµСЂРµС‚Р°С‰РёС‚Рµ С„Р°Р№Р» СЃСЋРґР° РёР»Рё РІС‹Р±РµСЂРёС‚Рµ РµРіРѕ РІСЂСѓС‡РЅСѓСЋ.</p>
              <p className={cn("mt-1 text-xs", mutedTextClassName)}>Р¤РѕСЂРјР°С‚С‹: MP4, MOV, WEBM, AVI. РњР°РєСЃРёРјСѓРј 5GB.</p>
              {selectedFile ? (
                <p className={cn("mt-2 text-sm font-medium", isLightTheme ? "text-neutral-900" : "text-neutral-100")}>
                  {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              ) : null}
            </div>
            <Button type="button" variant="outline" className={outlineButtonClassName} onClick={() => fileInputRef.current?.click()} disabled={isBusy}>
              Р’С‹Р±СЂР°С‚СЊ С„Р°Р№Р»
            </Button>
          </div>
        </div>
      </div>

      <div
        className={cn("version-upload-status rounded-md border px-3 py-2", isLightTheme ? "border-neutral-200 bg-white" : "border-neutral-700 bg-neutral-900/40")}
        aria-live="polite"
      >
        <p className={cn("text-sm", bodyTextClassName)}>РЎС‚Р°С‚СѓСЃ: {statusLabel[stage]}</p>
        {progressValue !== null ? (
          <div className={cn("mt-2 h-2 rounded", isLightTheme ? "bg-neutral-200" : "bg-neutral-700")} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressValue}>
            <div className="h-2 rounded bg-blue-500 transition-all" style={{ width: `${progressValue}%` }} />
          </div>
        ) : null}
      </div>

      {errorMessage ? <p className={cn("text-sm", isLightTheme ? "text-red-600" : "text-red-400")}>{errorMessage}</p> : null}

      <div className={cn("flex flex-col gap-2", surface === "dialog" ? "sm:flex-row sm:justify-end" : "sm:flex-row")}>
        {surface === "dialog" && onCancel ? (
          <Button type="button" variant="outline" className={outlineButtonClassName} onClick={onCancel} disabled={isBusy}>
            Р—Р°РєСЂС‹С‚СЊ
          </Button>
        ) : null}
        {stage === "uploading" ? (
          <Button type="button" variant="outline" className={outlineButtonClassName} onClick={handleCancelUpload}>
            РћС‚РјРµРЅРёС‚СЊ Р·Р°РіСЂСѓР·РєСѓ
          </Button>
        ) : null}
        {stage === "processing" ? (
          <Button type="button" variant="outline" className={outlineButtonClassName} onClick={handleContinueInBackground} disabled={continueInBackgroundRequested}>
            РџСЂРѕРґРѕР»Р¶РёС‚СЊ РІ С„РѕРЅРµ
          </Button>
        ) : null}
        <Button type="submit" className={cn(surface === "page" ? "w-full sm:w-auto" : "")} disabled={!canSubmit || isBusy || !selectedFile || !isVersionNoValid || hasVersionConflict}>
          {primaryButtonLabel}
        </Button>
      </div>
    </form>
  );
}

