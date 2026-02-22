"use client";

import KinescopeSdkPlayer from "@kinescope/react-kinescope-player";
import { AlertCircle, Loader2 } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
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
    const [isReady, setIsReady] = useState(false);
    const [playerError, setPlayerError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const resolvedVideoId = useMemo(() => resolveVideoId(videoId, videoUrl), [videoId, videoUrl]);

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
        getCurrentTime: () => currentTime,
        getCurrentTimeAsync: async () => {
          try {
            const value = await playerRef.current?.getCurrentTime();
            const normalized = normalizeSeconds(value);
            setCurrentTime(normalized);
            return normalized;
          } catch {
            return currentTime;
          }
        },
        getDuration: () => duration,
        isReady,
      }),
      [currentTime, duration, isReady],
    );

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
        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
          <KinescopeSdkPlayer
            key={resolvedVideoId}
            ref={playerRef}
            videoId={resolvedVideoId}
            autoPlay={Boolean(autoplay)}
            width="100%"
            height="100%"
            className="h-full w-full"
            onInit={() => {
              setPlayerError(null);
              setCurrentTime(0);
              setDuration(0);
              setIsReady(true);
              if (!readyNotifiedRef.current) {
                readyNotifiedRef.current = true;
                onReady?.();
              }
            }}
            onReady={() => {
              setPlayerError(null);
              setIsReady(true);
              if (!readyNotifiedRef.current) {
                readyNotifiedRef.current = true;
                onReady?.();
              }
            }}
            onTimeUpdate={(event: KinescopeTimeUpdateEvent) => {
              const normalized = normalizeSeconds(event?.currentTime);
              setCurrentTime(normalized);
              onTimeUpdate?.(normalized);
            }}
            onDurationChange={(event: KinescopeDurationEvent) => {
              setDuration(normalizeSeconds(event?.duration));
            }}
            onPlay={() => {
              onPlay?.();
            }}
            onPause={() => {
              onPause?.();
            }}
            onError={() => {
              const message = "Failed to load Kinescope player";
              setPlayerError(message);
              onError?.(message);
            }}
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
