"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KinescopePlayer, type KinescopePlayerRef } from "@/components/video/KinescopePlayer";
import { cn } from "@/lib/utils/cn";
import { getMessages } from "@/lib/i18n/messages";
import { formatTimecode } from "@/lib/utils/time";

type PortalVersion = {
  id: string;
  versionNumber: number;
  fileUrl: string;
  fileName: string;
  videoProvider: "KINESCOPE" | "EXTERNAL_URL" | "YOUTUBE_LEGACY";
  kinescopeVideoId: string | null;
  streamUrl: string | null;
  processingStatus: "UPLOADING" | "PROCESSING" | "READY" | "FAILED";
  durationSec: number | null;
  status: string;
  createdAt: string;
};

type PortalResponse = {
  project: {
    id: string;
    name: string;
    clientName: string;
    companyName: string;
  };
  activeVersionId: string | null;
  versions: PortalVersion[];
  feedback: Array<{
    id: string;
    text: string;
    timecodeSec: number | null;
    createdAt: string;
    authorName: string;
    authorEmail: string | null;
  }>;
};

const fetcher = async (url: string): Promise<PortalResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Failed to load client portal");
  }
  return (await response.json()) as PortalResponse;
};

export default function ClientPortalPage(): JSX.Element {
  const m = getMessages();
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = params.token;
  const requestedVersionId = searchParams.get("versionId") ?? undefined;

  const portalUrl = requestedVersionId
    ? `/api/public/portal/${token}?versionId=${encodeURIComponent(requestedVersionId)}`
    : `/api/public/portal/${token}`;

  const { data, isLoading, error, mutate } = useSWR(portalUrl, fetcher);
  const activeVersion = useMemo(
    () => data?.versions.find((version) => version.id === data.activeVersionId) ?? null,
    [data],
  );

  const kinescopeRef = useRef<KinescopePlayerRef | null>(null);
  const lastKnownTimeRef = useRef(0);
  const [playerCurrentTimeSec, setPlayerCurrentTimeSec] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [capturedTimecodeSec, setCapturedTimecodeSec] = useState<number | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);

  const safeVideoUrl = (activeVersion?.streamUrl ?? activeVersion?.fileUrl ?? "").trim();

  const pageBackground = "bg-[var(--app-bg)]";
  const shellCardClass =
    "rounded-[30px] border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow)] backdrop-blur-xl";
  const titleClass = "text-[color:var(--app-text)]";
  const mutedTextClass = "text-[color:var(--app-text-muted)]";
  const cardTextClass = "text-[color:var(--app-text)]";
  const inputCardClass =
    "flex flex-col gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-soft)] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4";
  const feedbackItemClass =
    "rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-soft)] p-4 shadow-[0_6px_24px_rgba(15,23,42,0.08)]";
  const isVersionLocked = activeVersion?.status === "APPROVED" || activeVersion?.status === "FINAL";

  const updatePlayerTime = (seconds: number): void => {
    const normalized = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    lastKnownTimeRef.current = normalized;
    setPlayerCurrentTimeSec(normalized);
  };

  const readCurrentPlayerTime = useCallback((): number => {
    return kinescopeRef.current?.getCurrentTime() ?? 0;
  }, []);

  const readKinescopeTimeSafe = useCallback(async (): Promise<number> => {
    const player = kinescopeRef.current;
    if (!player) {
      return 0;
    }

    if (typeof player.getCurrentTimeAsync === "function") {
      const asyncTime = await player.getCurrentTimeAsync().catch(() => 0);
      if (Number.isFinite(asyncTime) && asyncTime > 0) {
        return asyncTime;
      }
    }

    return player.getCurrentTime();
  }, []);

  useEffect(() => {
    setPlayerReady(false);
    setPlayerCurrentTimeSec(0);
    setCapturedTimecodeSec(null);
    lastKnownTimeRef.current = 0;
  }, [activeVersion?.id, safeVideoUrl, activeVersion?.kinescopeVideoId]);

  useEffect(() => {
    if (!playerReady || !activeVersion) {
      return;
    }

    const interval = window.setInterval(() => {
      void (async () => {
        try {
          const next = await readKinescopeTimeSafe();
          updatePlayerTime(next);
        } catch {
          updatePlayerTime(0);
        }
      })();
    }, 250);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeVersion, playerReady, readCurrentPlayerTime, readKinescopeTimeSafe]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const landscapeQuery = window.matchMedia("(orientation: landscape)");
    const mobileWidthQuery = window.matchMedia("(max-width: 1024px)");
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");

    const updateOrientationLayout = (): void => {
      const isLandscape = landscapeQuery.matches;
      const isMobileWidth = mobileWidthQuery.matches;
      const hasTouchPointer = coarsePointerQuery.matches || navigator.maxTouchPoints > 0 || "ontouchstart" in window;
      setIsMobileLandscape(isLandscape && isMobileWidth && hasTouchPointer);
    };

    updateOrientationLayout();

    const mediaChangeHandler = (): void => {
      updateOrientationLayout();
    };

    window.addEventListener("resize", mediaChangeHandler);
    window.addEventListener("orientationchange", mediaChangeHandler);

    if (typeof landscapeQuery.addEventListener === "function") {
      landscapeQuery.addEventListener("change", mediaChangeHandler);
      mobileWidthQuery.addEventListener("change", mediaChangeHandler);
      coarsePointerQuery.addEventListener("change", mediaChangeHandler);
    } else {
      landscapeQuery.addListener(mediaChangeHandler);
      mobileWidthQuery.addListener(mediaChangeHandler);
      coarsePointerQuery.addListener(mediaChangeHandler);
    }

    return () => {
      window.removeEventListener("resize", mediaChangeHandler);
      window.removeEventListener("orientationchange", mediaChangeHandler);

      if (typeof landscapeQuery.removeEventListener === "function") {
        landscapeQuery.removeEventListener("change", mediaChangeHandler);
        mobileWidthQuery.removeEventListener("change", mediaChangeHandler);
        coarsePointerQuery.removeEventListener("change", mediaChangeHandler);
      } else {
        landscapeQuery.removeListener(mediaChangeHandler);
        mobileWidthQuery.removeListener(mediaChangeHandler);
        coarsePointerQuery.removeListener(mediaChangeHandler);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <main className={`min-h-screen px-3 py-4 sm:px-6 sm:py-8 ${pageBackground}`}>
        <Card className={`mx-auto max-w-5xl animate-pulse ${shellCardClass}`}>
          <CardContent className="h-52 p-6" />
        </Card>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className={`min-h-screen px-3 py-4 sm:px-6 sm:py-8 ${pageBackground}`}>
        <Card className={`mx-auto max-w-2xl ${shellCardClass}`}>
          <CardHeader>
            <CardTitle className={`text-xl font-semibold tracking-tight ${titleClass}`}>{m.portal.title}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-600">{error instanceof Error ? error.message : "Portal unavailable"}</CardContent>
        </Card>
      </main>
    );
  }

  const selectVersion = (versionId: string): void => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("versionId", versionId);
    router.replace(`/client-portal/${token}?${params.toString()}`);
  };

  const captureCurrentTimecode = (): void => {
    if (!activeVersion) {
      toast.error("Version not found");
      return;
    }

    if (!playerReady) {
      toast.error(m.portal.playerNotReady);
      return;
    }

    kinescopeRef.current?.pause();

    window.setTimeout(async () => {
      const kinescopeTime = await readKinescopeTimeSafe();
      const rawTime = kinescopeTime;
      const directTime = Math.max(0, Math.floor(Number.isFinite(rawTime) ? rawTime : 0));
      const normalized = Math.max(directTime, lastKnownTimeRef.current, playerCurrentTimeSec);
      if (normalized === 0) {
        toast.error(m.portal.playBeforeCapture);
        return;
      }
      setCapturedTimecodeSec(normalized);
    }, 120);
  };

  const seekToTimecode = (timecodeSec: number | null): void => {
    const target = Number.isFinite(timecodeSec) ? Math.max(0, timecodeSec as number) : 0;
    kinescopeRef.current?.seekTo(target);
    kinescopeRef.current?.play();
  };

  const approveVersion = async (): Promise<void> => {
    if (!activeVersion) {
      return;
    }

    setApproving(true);

    try {
      const response = await fetch(`/api/public/portal/${token}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: activeVersion.id }),
      });
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(json?.error || m.portal.approveFailed);
      }
      setApproveDialogOpen(false);
      toast.success(m.portal.approvedSuccess);
      await mutate();
    } catch (approveError) {
      toast.error(approveError instanceof Error ? approveError.message : m.portal.approveFailed);
    } finally {
      setApproving(false);
    }
  };

  return (
    <main className={cn("portal-landscape-page min-h-screen px-3 py-4 sm:px-6 sm:py-8", pageBackground, isMobileLandscape && "portal-mobile-landscape")}>
      <section className="portal-landscape-grid mx-auto max-w-5xl space-y-4 sm:space-y-6">
        <Card className={cn(shellCardClass, "portal-main-card")}>
          <CardHeader className="space-y-3 pb-3">
            <CardTitle className={`text-2xl font-semibold tracking-tight sm:text-3xl ${titleClass}`}>{data.project.name}</CardTitle>
            {data.versions.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {data.versions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                      version.id === activeVersion?.id
                        ? "border-[color:var(--app-brand)] bg-[color:var(--app-brand)]/15 text-[color:var(--app-text)]"
                        : "border-[color:var(--app-border)] bg-[var(--app-surface-soft)] text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)]",
                    )}
                    onClick={() => selectVersion(version.id)}
                  >
                    Version {version.versionNumber}
                  </button>
                ))}
              </div>
            ) : (
              <p className={`text-sm ${mutedTextClass}`}>No versions uploaded yet.</p>
            )}
            {activeVersion ? (
              <p className={`text-xs sm:text-sm ${mutedTextClass}`}>
                Version {activeVersion.versionNumber}: {activeVersion.fileName}
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="portal-main-content space-y-4">
            {!activeVersion ? (
              <p className={`text-sm ${mutedTextClass}`}>This project has no uploaded versions yet.</p>
            ) : (
              <>
                <div className="portal-player-shell overflow-hidden rounded-3xl border border-white/70 bg-black/95 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:p-2">
                  <KinescopePlayer
                    ref={kinescopeRef}
                    className="w-full"
                    videoId={activeVersion.kinescopeVideoId}
                    videoUrl={safeVideoUrl}
                    onReady={() => setPlayerReady(true)}
                    onTimeUpdate={(seconds) => updatePlayerTime(seconds)}
                    onPlay={() => setPlayerReady(true)}
                  />
                </div>
                <div className={inputCardClass}>
                  <span className={`text-sm font-medium ${titleClass}`}>
                    {capturedTimecodeSec !== null
                      ? `${m.portal.selectedTime}: ${formatTimecode(capturedTimecodeSec)}`
                      : `${m.portal.currentTime}: ${formatTimecode(playerCurrentTimeSec)}`}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={captureCurrentTimecode}
                      type="button"
                      disabled={!playerReady || isVersionLocked}
                      className="h-11 rounded-full bg-[#007AFF] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(0,122,255,0.35)] hover:bg-[#0A84FF]"
                    >
                      {m.portal.addFeedbackAtCurrentTime}
                    </Button>
                    <Button
                      onClick={() => setApproveDialogOpen(true)}
                      type="button"
                      variant={isVersionLocked ? "outline" : "default"}
                      disabled={isVersionLocked}
                      className="h-11 rounded-full px-5 text-sm font-semibold"
                    >
                      {isVersionLocked ? m.portal.approved : m.portal.approveVersion}
                    </Button>
                  </div>
                </div>
                {activeVersion.processingStatus !== "READY" ? (
                  <p className={`text-xs ${mutedTextClass}`}>
                    {activeVersion.processingStatus === "FAILED"
                      ? "Kinescope processing failed for this version."
                      : "Kinescope is still processing this video. Playback may be temporarily unavailable."}
                  </p>
                ) : null}
                {isVersionLocked && <p className={`text-sm ${mutedTextClass}`}>{m.portal.approvalLocked}</p>}
              </>
            )}
          </CardContent>
        </Card>

        <Card className={cn(shellCardClass, "portal-feedback-card")}>
          <CardHeader>
            <CardTitle className={`text-xl font-semibold tracking-tight ${titleClass}`}>{m.portal.leaveFeedback}</CardTitle>
          </CardHeader>
          <CardContent className="portal-feedback-content">
            {activeVersion ? (
              <FeedbackForm
                capturedTimecodeSec={capturedTimecodeSec}
                versionId={activeVersion.id}
                disabled={isVersionLocked}
                disabledReason={isVersionLocked ? m.portal.approvalLocked : undefined}
                onSubmitted={() => {
                  setCapturedTimecodeSec(null);
                  void mutate();
                }}
              />
            ) : (
              <p className={`text-sm ${mutedTextClass}`}>Feedback is available after the first version upload.</p>
            )}
          </CardContent>
        </Card>

        <Card className={cn(shellCardClass, "portal-history-card")}>
          <CardHeader>
            <CardTitle className={`text-xl font-semibold tracking-tight ${titleClass}`}>{m.portal.recentFeedback}</CardTitle>
          </CardHeader>
          <CardContent className="portal-history-content space-y-3">
            {data.feedback.length === 0 && <p className={`text-sm ${mutedTextClass}`}>{m.portal.noFeedback}</p>}
            {data.feedback
              .filter((item) => !["Ping from debug", "Ping after queue fix", "Smoke after direct route"].includes(item.text))
              .map((item) => (
                <article key={item.id} className={feedbackItemClass}>
                  <div className={`mb-2 flex flex-wrap items-center gap-2 text-xs ${mutedTextClass}`}>
                    <span className={`font-medium ${titleClass}`}>{item.authorName}</span>
                    <button
                      type="button"
                      onClick={() => seekToTimecode(item.timecodeSec)}
                      className="rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface-soft)] px-2.5 text-[11px] text-blue-600"
                    >
                      {item.timecodeSec !== null ? formatTimecode(item.timecodeSec) : "No timecode"}
                    </button>
                  </div>
                  <p className={`text-sm leading-relaxed ${cardTextClass}`}>{item.text}</p>
                </article>
              ))}
          </CardContent>
        </Card>

        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{m.portal.approveDialogTitle}</DialogTitle>
              <DialogDescription>{m.portal.approveDialogDescription}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveDialogOpen(false)} disabled={approving}>
                {m.portal.cancel}
              </Button>
              <Button onClick={approveVersion} disabled={approving || !activeVersion}>
                {approving ? "..." : m.portal.approveConfirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
      <style jsx global>{`
        .portal-landscape-page.portal-mobile-landscape {
            min-height: 100dvh;
            padding: 0.75rem;
        }

        .portal-landscape-page.portal-mobile-landscape .portal-landscape-grid {
            max-width: none;
            height: calc(100dvh - 1.5rem);
            margin: 0;
            display: grid;
            grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
            grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
            gap: 0.75rem;
            align-items: stretch;
        }

        .portal-landscape-page.portal-mobile-landscape .portal-main-card,
        .portal-landscape-page.portal-mobile-landscape .portal-feedback-card,
        .portal-landscape-page.portal-mobile-landscape .portal-history-card {
            margin: 0;
            height: 100%;
        }

        .portal-landscape-page.portal-mobile-landscape .portal-main-card {
            grid-column: 1;
            grid-row: 1 / span 2;
            display: flex;
            flex-direction: column;
        }

        .portal-landscape-page.portal-mobile-landscape .portal-main-content,
        .portal-landscape-page.portal-mobile-landscape .portal-feedback-content,
        .portal-landscape-page.portal-mobile-landscape .portal-history-content {
            min-height: 0;
            overflow: auto;
        }

        .portal-landscape-page.portal-mobile-landscape .portal-player-shell {
            max-height: 52dvh;
        }

        .portal-landscape-page.portal-mobile-landscape .portal-player-shell .aspect-video {
            max-height: 50dvh;
        }

        .portal-landscape-page.portal-mobile-landscape .portal-feedback-card {
            grid-column: 2;
            grid-row: 1;
            display: flex;
            flex-direction: column;
        }

        .portal-landscape-page.portal-mobile-landscape .portal-history-card {
            grid-column: 2;
            grid-row: 2;
            display: flex;
            flex-direction: column;
        }

        .portal-landscape-page.portal-mobile-landscape .portal-main-card .portal-main-content {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }

        .portal-landscape-page.portal-mobile-landscape .portal-main-card .portal-main-content > .portal-player-shell {
            flex: 0 0 auto;
        }
      `}</style>
    </main>
  );
}
