"use client";

import { useMemo } from "react";
import { YouTubePlayer } from "@/components/video/YouTubePlayer";

type VideoPlayerProps = {
  videoUrl: string;
  className?: string;
};

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/i.test(url);
}

export function VideoPlayer({ videoUrl, className }: VideoPlayerProps): JSX.Element {
  const safeUrl = useMemo(() => videoUrl.trim(), [videoUrl]);

  if (!safeUrl) {
    return <div className="rounded border border-neutral-200 p-4 text-sm text-neutral-500">Video URL is missing.</div>;
  }

  if (isYouTubeUrl(safeUrl)) {
    return <YouTubePlayer className={className} videoUrl={safeUrl} />;
  }

  return (
    <div className={className}>
      <video className="h-auto w-full rounded-lg bg-black" controls preload="metadata" src={safeUrl}>
        <track kind="captions" />
      </video>
    </div>
  );
}
