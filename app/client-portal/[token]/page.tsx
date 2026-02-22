"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KinescopePlayer, type KinescopePlayerRef } from "@/components/video/KinescopePlayer";
import { YouTubePlayer, type YouTubePlayerRef } from "@/components/video/YouTubePlayer";
import { getMessages } from "@/lib/i18n/messages";
import { formatTimecode } from "@/lib/utils/time";

type PortalResponse = {
  project: {
    id: string;
    name: string;
    clientName: string;
    companyName: string;
  };
  version: {
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

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/i.test(url);
}

export default function ClientPortalPage(): JSX.Element {
  const m = getMessages();
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { data, isLoading, error, mutate } = useSWR(`/api/public/portal/${token}`, fetcher);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const youtubeRef = useRef<YouTubePlayerRef | null>(null);
  const kinescopeRef = useRef<KinescopePlayerRef | null>(null);
  const lastKnownTimeRef = useRef(0);
  const [playerCurrentTimeSec, setPlayerCurrentTimeSec] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [capturedTimecodeSec, setCapturedTimecodeSec] = useState<number | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const safeVideoUrl = (data?.version.streamUrl ?? data?.version.fileUrl ?? "").trim();
  const videoProvider = data?.version.videoProvider ?? "EXTERNAL_URL";
  const videoIsKinescope = videoProvider === "KINESCOPE";
  const videoIsYouTube = !videoIsKinescope && isYouTubeUrl(safeVideoUrl);

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
  const isVersionLocked = data?.version.status === "APPROVED" || data?.version.status === "FINAL";

  const updatePlayerTime = (seconds: number): void => {
    const normalized = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    lastKnownTimeRef.current = normalized;
    setPlayerCurrentTimeSec(normalized);
  };

  const readCurrentPlayerTime = useCallback((): number => {
    if (videoIsKinescope) {
      return kinescopeRef.current?.getCurrentTime() ?? 0;
    }
    if (videoIsYouTube) {
      return youtubeRef.current?.getCurrentTime() ?? 0;
    }
    return nativeVideoRef.current?.currentTime ?? 0;
  }, [videoIsKinescope, videoIsYouTube]);

  useEffect(() => {
    setPlayerReady(false);
    setPlayerCurrentTimeSec(0);
    setCapturedTimecodeSec(null);
    lastKnownTimeRef.current = 0;
  }, [data?.version.id, videoProvider, safeVideoUrl, data?.version.kinescopeVideoId]);

  useEffect(() => {
    if (!playerReady) {
      return;
    }

    const interval = window.setInterval(() => {
      updatePlayerTime(readCurrentPlayerTime());
    }, 250);

    return () => {
      window.clearInterval(interval);
    };
  }, [playerReady, readCurrentPlayerTime]);

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

  const captureCurrentTimecode = (): void => {
    if (!playerReady) {
      toast.error(m.portal.playerNotReady);
      return;
    }

    if (videoIsYouTube) {
      youtubeRef.current?.pause();
    } else if (videoIsKinescope) {
      kinescopeRef.current?.pause();
    } else {
      nativeVideoRef.current?.pause();
    }

    window.setTimeout(() => {
      const rawTime = readCurrentPlayerTime();
      const directTime = Math.max(0, Math.floor(Number.isFinite(rawTime) ? rawTime : 0));
      const normalized = Math.max(directTime, lastKnownTimeRef.current, playerCurrentTimeSec);
      if (normalized === 0) {
        toast.error(m.portal.playBeforeCapture);
        return;
      }
      setCapturedTimecodeSec(normalized);
    }, 120);
  };

  const approveVersion = async (): Promise<void> => {
    setApproving(true);

    try {
      const response = await fetch(`/api/public/portal/${token}/approve`, {
        method: "POST",
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
    <main className={`min-h-screen px-3 py-4 sm:px-6 sm:py-8 ${pageBackground}`}>
      <section className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        <Card className={shellCardClass}>
          <CardHeader className="space-y-2 pb-3">
            <CardTitle className={`text-2xl font-semibold tracking-tight sm:text-3xl ${titleClass}`}>{data.project.name}</CardTitle>
            <p className={`text-xs sm:text-sm ${mutedTextClass}`}>
              Version {data.version.versionNumber}: {data.version.fileName}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-3xl border border-white/70 bg-black/95 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:p-2">
              {videoIsKinescope ? (
                <KinescopePlayer
                  ref={kinescopeRef}
                  className="w-full"
                  videoId={data.version.kinescopeVideoId}
                  videoUrl={safeVideoUrl}
                  onReady={() => setPlayerReady(true)}
                  onTimeUpdate={(seconds) => updatePlayerTime(seconds)}
                  onPlay={() => setPlayerReady(true)}
                />
              ) : videoIsYouTube ? (
                <YouTubePlayer
                  ref={youtubeRef}
                  className="w-full"
                  videoUrl={safeVideoUrl}
                  onReady={() => setPlayerReady(true)}
                  onTimeUpdate={(seconds) => updatePlayerTime(seconds)}
                  onPlay={() => setPlayerReady(true)}
                />
              ) : (
                <video
                  ref={nativeVideoRef}
                  className="h-auto w-full rounded-[20px] bg-black"
                  controls
                  preload="metadata"
                  src={safeVideoUrl}
                  onLoadedMetadata={() => setPlayerReady(true)}
                  onCanPlay={() => setPlayerReady(true)}
                  onTimeUpdate={(event) => updatePlayerTime(event.currentTarget.currentTime)}
                >
                  <track kind="captions" />
                </video>
              )}
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
            {videoIsKinescope && data.version.processingStatus !== "READY" ? (
              <p className={`text-xs ${mutedTextClass}`}>
                {data.version.processingStatus === "FAILED"
                  ? "Kinescope processing failed for this version."
                  : "Kinescope is still processing this video. Playback may be temporarily unavailable."}
              </p>
            ) : null}
            {isVersionLocked && <p className={`text-sm ${mutedTextClass}`}>{m.portal.approvalLocked}</p>}
          </CardContent>
        </Card>

        <Card className={shellCardClass}>
          <CardHeader>
            <CardTitle className={`text-xl font-semibold tracking-tight ${titleClass}`}>{m.portal.leaveFeedback}</CardTitle>
          </CardHeader>
          <CardContent>
            <FeedbackForm
              capturedTimecodeSec={capturedTimecodeSec}
              versionId={data.version.id}
              disabled={isVersionLocked}
              disabledReason={isVersionLocked ? m.portal.approvalLocked : undefined}
              onSubmitted={() => {
                setCapturedTimecodeSec(null);
                void mutate();
              }}
            />
          </CardContent>
        </Card>

        <Card className={shellCardClass}>
          <CardHeader>
            <CardTitle className={`text-xl font-semibold tracking-tight ${titleClass}`}>{m.portal.recentFeedback}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.feedback.length === 0 && <p className={`text-sm ${mutedTextClass}`}>{m.portal.noFeedback}</p>}
            {data.feedback.map((item) => (
              <article key={item.id} className={feedbackItemClass}>
                <div className={`mb-2 flex flex-wrap items-center gap-2 text-xs ${mutedTextClass}`}>
                  <span className={`font-medium ${titleClass}`}>{item.authorName}</span>
                  <Badge
                    variant="secondary"
                    className="rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface-soft)] px-2.5 text-[11px] text-[color:var(--app-text)]"
                  >
                    {item.timecodeSec !== null ? formatTimecode(item.timecodeSec) : "No timecode"}
                  </Badge>
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
              <Button onClick={approveVersion} disabled={approving}>
                {approving ? "..." : m.portal.approveConfirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </main>
  );
}
