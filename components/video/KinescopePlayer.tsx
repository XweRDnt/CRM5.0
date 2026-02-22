"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

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
  getDuration: () => number;
  isReady: boolean;
}

type PlayerMessage = {
  event?: string;
  type?: string;
  currentTime?: number;
  duration?: number;
  data?: {
    currentTime?: number;
    duration?: number;
  };
};

const DEFAULT_KINESCOPE_ORIGIN = "https://kinescope.io";

function resolveEmbedSrc(videoId?: string | null, videoUrl?: string): { src: string; targetOrigin: string } {
  if (videoId?.trim()) {
    const normalizedOrigin = DEFAULT_KINESCOPE_ORIGIN.replace(/\/+$/, "");
    return {
      src: `${normalizedOrigin}/${videoId.trim()}`,
      targetOrigin: DEFAULT_KINESCOPE_ORIGIN,
    };
  }

  if (videoUrl?.trim()) {
    const normalized = videoUrl.trim();
    try {
      const parsed = new URL(normalized);
      return {
        src: parsed.toString(),
        targetOrigin: parsed.origin,
      };
    } catch {
      return { src: normalized, targetOrigin: "*" };
    }
  }

  return { src: "", targetOrigin: "*" };
}

export const KinescopePlayer = forwardRef<KinescopePlayerRef, KinescopePlayerProps>(
  ({ videoId, videoUrl, onTimeUpdate, onPause, onPlay, onReady, onError, autoplay, className }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [playerError, setPlayerError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const embed = useMemo(() => resolveEmbedSrc(videoId, videoUrl), [videoId, videoUrl]);
    const embedSrc = embed.src;
    const targetOrigin = embed.targetOrigin;

    useEffect(() => {
      if (!embedSrc) {
        onError?.("Kinescope video is not configured");
      }
    }, [embedSrc, onError]);

    useEffect(() => {
      const iframe = iframeRef.current;
      if (!iframe) {
        return;
      }

      const handleMessage = (event: MessageEvent<unknown>): void => {
        if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) {
          return;
        }
        if (targetOrigin !== "*" && event.origin !== targetOrigin) {
          return;
        }

        const payload = (event.data ?? {}) as PlayerMessage;
        const eventName = payload.event ?? payload.type ?? "";
        const time = payload.currentTime ?? payload.data?.currentTime;
        const nextDuration = payload.duration ?? payload.data?.duration;

        if (typeof time === "number" && Number.isFinite(time)) {
          const normalized = Math.max(0, Math.floor(time));
          setCurrentTime(normalized);
          onTimeUpdate?.(normalized);
        }

        if (typeof nextDuration === "number" && Number.isFinite(nextDuration)) {
          setDuration(Math.max(0, Math.floor(nextDuration)));
        }

        if (eventName === "ready" || eventName === "player.ready") {
          setIsReady((prev) => {
            if (!prev) {
              onReady?.();
            }
            return true;
          });
        }
        if (eventName === "play" || eventName === "player.play") {
          onPlay?.();
        }
        if (eventName === "pause" || eventName === "player.pause") {
          onPause?.();
        }
      };

      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }, [onPause, onPlay, onReady, onTimeUpdate, targetOrigin]);

    useEffect(() => {
      if (!autoplay || !isReady || !iframeRef.current?.contentWindow) {
        return;
      }
      iframeRef.current.contentWindow.postMessage({ type: "command", method: "play" }, targetOrigin);
    }, [autoplay, isReady, targetOrigin]);

    const sendCommand = useCallback((method: string, args: Record<string, unknown> = {}): void => {
      if (!iframeRef.current?.contentWindow) {
        return;
      }
      iframeRef.current.contentWindow.postMessage({ type: "command", method, ...args }, targetOrigin);
    }, [targetOrigin]);

    useImperativeHandle(
      ref,
      () => ({
        play: () => sendCommand("play"),
        pause: () => sendCommand("pause"),
        seekTo: (seconds: number) => sendCommand("seekTo", { seconds }),
        getCurrentTime: () => currentTime,
        getDuration: () => duration,
        isReady,
      }),
      [currentTime, duration, isReady, sendCommand],
    );

    if (!embedSrc) {
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
          <iframe
            ref={iframeRef}
            src={embedSrc}
            className="h-full w-full border-0"
            title="Kinescope video player"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            onLoad={() => {
              setPlayerError(null);
              setIsReady(false);
              setCurrentTime(0);
              setDuration(0);
            }}
            onError={() => {
              const message = "Failed to load Kinescope player";
              setPlayerError(message);
              onError?.(message);
            }}
          />

          {!isReady && !playerError ? (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/70 text-sm text-white">
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
