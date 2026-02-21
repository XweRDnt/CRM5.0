"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
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

function resolveEmbedSrc(videoId?: string | null, videoUrl?: string): string {
  if (videoUrl?.trim()) {
    return videoUrl.trim();
  }
  if (videoId?.trim()) {
    return `https://kinescope.io/${videoId.trim()}`;
  }
  return "";
}

export const KinescopePlayer = forwardRef<KinescopePlayerRef, KinescopePlayerProps>(
  ({ videoId, videoUrl, onTimeUpdate, onPause, onPlay, onReady, onError, autoplay, className }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [playerError, setPlayerError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const embedSrc = useMemo(() => resolveEmbedSrc(videoId, videoUrl), [videoId, videoUrl]);

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
          setIsReady(true);
          onReady?.();
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
    }, [onPause, onPlay, onReady, onTimeUpdate]);

    useEffect(() => {
      if (!autoplay || !isReady || !iframeRef.current?.contentWindow) {
        return;
      }
      iframeRef.current.contentWindow.postMessage({ type: "command", method: "play" }, "*");
    }, [autoplay, isReady]);

    const sendCommand = (method: string, args: Record<string, unknown> = {}): void => {
      if (!iframeRef.current?.contentWindow) {
        return;
      }
      iframeRef.current.contentWindow.postMessage({ type: "command", method, ...args }, "*");
    };

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
      [currentTime, duration, isReady],
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
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            onLoad={() => {
              setPlayerError(null);
              setIsReady(true);
              onReady?.();
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
