'use client'

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { useYouTubePlayer } from '@/lib/hooks/useYouTubePlayer'
import { cn } from '@/lib/utils/cn'

export interface YouTubePlayerProps {
  videoUrl: string
  onTimeUpdate?: (seconds: number) => void
  onPause?: () => void
  onPlay?: () => void
  onReady?: () => void
  onError?: (error: string) => void
  autoplay?: boolean
  className?: string
}

export interface YouTubePlayerRef {
  play: () => void
  pause: () => void
  seekTo: (seconds: number) => void
  getCurrentTime: () => number
  getDuration: () => number
  isReady: boolean
}

const INVALID_URL_ERROR = 'Invalid YouTube URL'
const VIDEO_UNAVAILABLE_ERROR = 'Video unavailable'
const FAILED_LOAD_ERROR = 'Failed to load video player'
const PLAYER_STATE_PLAYING = 1
const PLAYER_STATE_PAUSED = 2

const UNAVAILABLE_VIDEO_CODES = new Set([100, 101, 150])

const extractVideoId = (url: string): string | null => {
  const normalized = url.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(normalized)) {
    return normalized
  }

  const patterns = [
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

export const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>(
  (
    { videoUrl, onTimeUpdate, onPause, onPlay, onReady, onError, autoplay = false, className },
    ref
  ) => {
    const rawPlayerId = useId()
    const playerId = useMemo(
      () => `youtube-player-${rawPlayerId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
      [rawPlayerId]
    )
    const videoId = useMemo(() => extractVideoId(videoUrl), [videoUrl])
    const [playerError, setPlayerError] = useState<string | null>(null)

    const { isReady, initializePlayer, play, pause, seekTo, getCurrentTime, getDuration, destroy } =
      useYouTubePlayer({
        onReady: () => {
          setPlayerError(null)
          onReady?.()
        },
        onTimeUpdate: (seconds) => {
          onTimeUpdate?.(seconds)
        },
        onStateChange: (state) => {
          if (state === PLAYER_STATE_PLAYING) {
            onPlay?.()
          }
          if (state === PLAYER_STATE_PAUSED) {
            onPause?.()
          }
        },
        onError: (playerError) => {
          const message = UNAVAILABLE_VIDEO_CODES.has(playerError.code)
            ? VIDEO_UNAVAILABLE_ERROR
            : FAILED_LOAD_ERROR
          setPlayerError(message)
          onError?.(message)
        },
      })

    useEffect(() => {
      if (!videoId) {
        destroy()
        onError?.(INVALID_URL_ERROR)
        return
      }

      initializePlayer(playerId, videoId)
      return () => {
        destroy()
      }
    }, [destroy, initializePlayer, onError, playerId, videoId])

    useEffect(() => {
      if (!autoplay || !isReady) {
        return
      }

      play()
    }, [autoplay, isReady, play])

    const error = videoId ? playerError : INVALID_URL_ERROR
    const isLoading = Boolean(videoId) && !isReady && !error

    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          if (!isReady) {
            return
          }
          play()
        },
        pause: () => {
          if (!isReady) {
            return
          }
          pause()
        },
        seekTo: (seconds: number) => {
          if (!isReady) {
            return
          }
          seekTo(seconds)
        },
        getCurrentTime: () => {
          if (!isReady) {
            return 0
          }
          return getCurrentTime()
        },
        getDuration: () => {
          if (!isReady) {
            return 0
          }
          return getDuration()
        },
        isReady,
      }),
      [getCurrentTime, getDuration, isReady, pause, play, seekTo]
    )

    return (
      <div className={cn('w-full', className)}>
        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
          <div id={playerId} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />

          {isLoading && !error ? (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/70 text-sm text-white">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              <span>Loading video player...</span>
            </div>
          ) : null}

          {error ? (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/80 p-4 text-center text-sm text-red-100">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}
        </div>
      </div>
    )
  }
)

YouTubePlayer.displayName = 'YouTubePlayer'
