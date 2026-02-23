"use client";

import KinescopeSdkPlayer from "@kinescope/react-kinescope-player";
import { AlertCircle, Loader2 } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

type KinescopeTimeUpdateEvent = {
  currentTime?: number;
};

type KinescopeDurationEvent = {
  duration?: number;
};

export interface KinescopePlayerProps {
  videoId?: string | null;
  videoUrl?: string;
  onTimeUpdate?: (seconds: number) => void;
  onPause?: () => void;
  onPlay?: () => void;
  onReady?: () => void;
  onError?: (error: string) => void;
  autoplay?: boolean;
  className?: string;
}

export interface KinescopePlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  setFullscreen: (fullscreen: boolean) => void;
  getCurrentTime: () => number;
  getCurrentTimeAsync: () => Promise<number>;
  getDuration: () => number;
  isReady: boolean;
}

function normalizeSeconds(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function resolveVideoId(videoId?: string | null, videoUrl?: string): string | null {
  if (videoId?.trim()) {
    return videoId.trim();
  }

  if (!videoUrl?.trim()) {
    return null;
  }

  const raw = videoUrl.trim();
  try {
    const parsed = new URL(raw);
    const pathCandidate = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    return pathCandidate || null;
  } catch {
    const normalized = raw.replace(/^https?:\/\//i, "");
    const pathCandidate = normalized.split("/").filter(Boolean)[1] ?? normalized;
    return pathCandidate || null;
  }
}

export const KinescopePlayer = forwardRef<KinescopePlayerRef, KinescopePlayerProps>(
  ({ videoId, videoUrl, onTimeUpdate, onPause, onPlay, onReady, onError, autoplay, className }, ref) => {
    const playerRef = useRef<InstanceType<typeof KinescopeSdkPlayer> | null>(null);
    const readyNotifiedRef = useRef(false);
    const currentTimeRef = useRef(0);
    const durationRef = useRef(0);
    const [isReady, setIsReady] = useState(false);
    const [playerError, setPlayerError] = useState<string | null>(null);
    const resolvedVideoId = useMemo(() => resolveVideoId(videoId, videoUrl), [videoId, videoUrl]);
    const playsInline = useMemo(() => {
      if (typeof navigator === "undefined") {
        return true;
      }
      return !/Android/i.test(navigator.userAgent ?? "");
    }, []);

    useEffect(() => {
      if (!resolvedVideoId) {
        onError?.("Kinescope video is not configured");
      }
      readyNotifiedRef.current = false;
    }, [onError, resolvedVideoId]);

    useEffect(() => {
      if (!resolvedVideoId || isReady || playerError) {
        return;
      }

      const timeout = window.setTimeout(() => {
        const message = "Kinescope player is taking too long to load";
        setPlayerError(message);
        onError?.(message);
      }, 12000);

      return () => window.clearTimeout(timeout);
    }, [isReady, onError, playerError, resolvedVideoId]);

    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          void playerRef.current?.play().catch(() => undefined);
        },
        pause: () => {
          void playerRef.current?.pause().catch(() => undefined);
        },
        seekTo: (seconds: number) => {
          void playerRef.current?.seekTo(Math.max(0, Number.isFinite(seconds) ? seconds : 0)).catch(() => undefined);
        },
        setFullscreen: (fullscreen: boolean) => {
          void playerRef.current?.setFullscreen(Boolean(fullscreen)).catch(() => undefined);
        },
        getCurrentTime: () => currentTimeRef.current,
        getCurrentTimeAsync: async () => {
          try {
            const value = await playerRef.current?.getCurrentTime();
            const normalized = normalizeSeconds(value);
            currentTimeRef.current = normalized;
            return normalized;
          } catch {
            return currentTimeRef.current;
          }
        },
        getDuration: () => durationRef.current,
        isReady,
      }),
      [isReady],
    );

    const handleInit = useCallback(() => {
      setPlayerError(null);
      currentTimeRef.current = 0;
      durationRef.current = 0;
      setIsReady(true);
      if (!readyNotifiedRef.current) {
        readyNotifiedRef.current = true;
        onReady?.();
      }
    }, [onReady]);

    const handleReady = useCallback(() => {
      setPlayerError(null);
      setIsReady(true);
      if (!readyNotifiedRef.current) {
        readyNotifiedRef.current = true;
        onReady?.();
      }
    }, [onReady]);

    const handleTimeUpdate = useCallback((event: KinescopeTimeUpdateEvent) => {
      const normalized = normalizeSeconds(event?.currentTime);
      currentTimeRef.current = normalized;
      onTimeUpdate?.(normalized);
    }, [onTimeUpdate]);

    const handleDurationChange = useCallback((event: KinescopeDurationEvent) => {
      durationRef.current = normalizeSeconds(event?.duration);
    }, []);

    const handlePlay = useCallback(() => {
      onPlay?.();
    }, [onPlay]);

    const handlePause = useCallback(() => {
      onPause?.();
    }, [onPause]);

    const handleError = useCallback(() => {
      const message = "Failed to load Kinescope player";
      setPlayerError(message);
      onError?.(message);
    }, [onError]);

    if (!resolvedVideoId) {
      return (
        <div className={cn("flex items-center gap-2 rounded-md bg-black/80 p-4 text-sm text-red-100", className)}>
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Kinescope video is not configured.</span>
        </div>
      );
    }

    return (
      <div className={cn("w-full", className)}>
        <div className="relative aspect-video w-full overflow-clip rounded-md bg-black">
          <KinescopeSdkPlayer
            ref={playerRef}
            videoId={resolvedVideoId}
            autoPlay={Boolean(autoplay)}
            playsInline={playsInline}
            controls={true}
            width="100%"
            height="100%"
            className="h-full w-full"
            onInit={handleInit}
            onReady={handleReady}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleDurationChange}
            onPlay={handlePlay}
            onPause={handlePause}
            onError={handleError}
          />

          {!isReady && !playerError ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-black/70 text-sm text-white">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              <span>Loading video player...</span>
            </div>
          ) : null}

          {playerError ? (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/80 p-4 text-center text-sm text-red-100">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              <span>{playerError}</span>
            </div>
          ) : null}
        </div>
      </div>
    );
  },
);

KinescopePlayer.displayName = "KinescopePlayer";
