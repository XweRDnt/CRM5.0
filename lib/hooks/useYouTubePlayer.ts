import { useState, useRef, useEffect, useCallback } from 'react'

export interface UseYouTubePlayerReturn {
  player: YT.Player | null
  isReady: boolean
  currentTime: number
  duration: number
  isPlaying: boolean
  initializePlayer: (elementId: string, videoId: string) => void
  play: () => void
  pause: () => void
  seekTo: (seconds: number) => void
  getCurrentTime: () => number
  getDuration: () => number
  destroy: () => void
}

export interface UseYouTubePlayerOptions {
  onReady?: () => void
  onTimeUpdate?: (currentTime: number) => void
  onStateChange?: (state: YT.PlayerState) => void
  onError?: (error: YT.PlayerError) => void
}

type PlayerMethodHost = {
  playVideo?: () => void
  pauseVideo?: () => void
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime?: () => number
  getDuration?: () => number
  destroy?: () => void
}

function hasTimeApi(player: unknown): player is { getCurrentTime: () => number } {
  if (!player || typeof player !== 'object') {
    return false
  }

  const candidate = player as { getCurrentTime?: unknown }
  return typeof candidate.getCurrentTime === 'function'
}

function toFiniteOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function asPlayerMethodHost(player: unknown): PlayerMethodHost {
  if (!player || typeof player !== 'object') {
    return {}
  }

  return player as PlayerMethodHost
}

export function useYouTubePlayer(
  options: UseYouTubePlayerOptions = {}
): UseYouTubePlayerReturn {
  const playerRef = useRef<YT.Player | null>(null)
  const initSeqRef = useRef(0)
  const apiLoadPromiseRef = useRef<Promise<void> | null>(null)
  const optionsRef = useRef(options)

  const [player, setPlayer] = useState<YT.Player | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const safeGetCurrentTime = useCallback((value: unknown): number => {
    const host = asPlayerMethodHost(value)
    if (typeof host.getCurrentTime !== 'function') {
      return 0
    }

    return toFiniteOrZero(host.getCurrentTime())
  }, [])

  const safeGetDuration = useCallback((value: unknown): number => {
    const host = asPlayerMethodHost(value)
    if (typeof host.getDuration !== 'function') {
      return 0
    }

    return toFiniteOrZero(host.getDuration())
  }, [])

  const loadYouTubeAPI = useCallback((): Promise<void> => {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('YouTube API can only be loaded in browser'))
    }

    if (window.YT?.Player) {
      return Promise.resolve()
    }

    if (apiLoadPromiseRef.current) {
      return apiLoadPromiseRef.current
    }

    apiLoadPromiseRef.current = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
      ) as HTMLScriptElement | null

      const previousReady = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.()
        resolve()
      }

      if (!existingScript) {
        const script = document.createElement('script')
        script.src = 'https://www.youtube.com/iframe_api'
        script.async = true
        script.onerror = () => {
          reject(new Error('Failed to load YouTube IFrame API'))
        }
        document.head.appendChild(script)
      }
    })

    return apiLoadPromiseRef.current
  }, [])

  const destroy = useCallback((): void => {
    initSeqRef.current += 1

    if (playerRef.current) {
      const host = asPlayerMethodHost(playerRef.current)
      if (typeof host.destroy === 'function') {
        host.destroy()
      }
      playerRef.current = null
    }

    setPlayer(null)
    setIsReady(false)
    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(false)
  }, [])

  const initializePlayer = useCallback(
    (elementId: string, videoId: string): void => {
      if (!elementId.trim()) {
        throw new Error('Element id is required')
      }
      if (!videoId.trim()) {
        throw new Error('Video id is required')
      }

      void (async () => {
        if (playerRef.current) {
          destroy()
        }

        initSeqRef.current += 1
        const initId = initSeqRef.current

        await loadYouTubeAPI()

        if (initId !== initSeqRef.current) {
          return
        }

        if (!window.YT?.Player) {
          throw new Error('YouTube API is unavailable')
        }

        const newPlayer = new window.YT.Player(elementId, {
          videoId,
          events: {
            onReady: (event) => {
              if (initId !== initSeqRef.current) {
                return
              }

              // In some runtimes constructor return value is not a full API object.
              // Use the ready event target as the canonical player instance.
              playerRef.current = event.target
              setPlayer(event.target)
              setIsReady(true)
              setDuration(safeGetDuration(event.target))
              optionsRef.current.onReady?.()
            },
            onStateChange: (event) => {
              if (initId !== initSeqRef.current) {
                return
              }
              setIsPlaying(event.data === window.YT.PlayerState.PLAYING)
              optionsRef.current.onStateChange?.(event.data)
            },
            onError: (event) => {
              if (initId !== initSeqRef.current) {
                return
              }
              optionsRef.current.onError?.({
                code: event.data,
                message: `YouTube player error code: ${event.data}`,
              })
            },
          },
          playerVars: {
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
          },
        })

        // Keep a temporary reference only if constructor returns full API object.
        // Do not overwrite canonical event.target from onReady.
        if (initId === initSeqRef.current && (!playerRef.current || !hasTimeApi(playerRef.current))) {
          playerRef.current = newPlayer
          setPlayer(newPlayer)
        }
      })().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to initialize player'
        optionsRef.current.onError?.({ code: -1, message })
      })
    },
    [destroy, loadYouTubeAPI, safeGetDuration]
  )

  const getRequiredPlayer = useCallback((): YT.Player => {
    if (!playerRef.current) {
      throw new Error('Player not initialized')
    }
    return playerRef.current
  }, [])

  const play = useCallback((): void => {
    const readyPlayer = getRequiredPlayer()
    const host = asPlayerMethodHost(readyPlayer)

    if (typeof host.playVideo === 'function') {
      host.playVideo()
    }

    const time = safeGetCurrentTime(readyPlayer)
    setCurrentTime(time)
    optionsRef.current.onTimeUpdate?.(time)
  }, [getRequiredPlayer, safeGetCurrentTime])

  const pause = useCallback((): void => {
    const readyPlayer = getRequiredPlayer()
    const host = asPlayerMethodHost(readyPlayer)

    if (typeof host.pauseVideo === 'function') {
      host.pauseVideo()
    }
  }, [getRequiredPlayer])

  const seekTo = useCallback(
    (seconds: number): void => {
      const readyPlayer = getRequiredPlayer()
      const host = asPlayerMethodHost(readyPlayer)

      if (typeof host.seekTo === 'function') {
        host.seekTo(seconds, true)
      }

      setCurrentTime(seconds)
      optionsRef.current.onTimeUpdate?.(seconds)
    },
    [getRequiredPlayer]
  )

  const getCurrentTime = useCallback((): number => {
    const readyPlayer = getRequiredPlayer()
    return safeGetCurrentTime(readyPlayer)
  }, [getRequiredPlayer, safeGetCurrentTime])

  const getDuration = useCallback((): number => {
    const readyPlayer = getRequiredPlayer()
    return safeGetDuration(readyPlayer)
  }, [getRequiredPlayer, safeGetDuration])

  useEffect(() => {
    if (!playerRef.current || !isReady) {
      return
    }

    const interval = setInterval(() => {
      if (!playerRef.current) {
        return
      }

      const time = safeGetCurrentTime(playerRef.current)
      setCurrentTime(time)
      optionsRef.current.onTimeUpdate?.(time)
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [isReady, safeGetCurrentTime])

  useEffect(() => {
    return () => {
      destroy()
    }
  }, [destroy])

  return {
    player,
    isReady,
    currentTime,
    duration,
    isPlaying,
    initializePlayer,
    play,
    pause,
    seekTo,
    getCurrentTime,
    getDuration,
    destroy,
  }
}
