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

export function useYouTubePlayer(
  options: UseYouTubePlayerOptions = {}
): UseYouTubePlayerReturn {
  const playerRef = useRef<YT.Player | null>(null)
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
    if (playerRef.current) {
      playerRef.current.destroy()
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

        await loadYouTubeAPI()

        if (!window.YT?.Player) {
          throw new Error('YouTube API is unavailable')
        }

        const newPlayer = new window.YT.Player(elementId, {
          videoId,
          events: {
            onReady: (event) => {
              setIsReady(true)
              setDuration(event.target.getDuration())
              optionsRef.current.onReady?.()
            },
            onStateChange: (event) => {
              setIsPlaying(event.data === window.YT.PlayerState.PLAYING)
              optionsRef.current.onStateChange?.(event.data)
            },
            onError: (event) => {
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

        playerRef.current = newPlayer
        setPlayer(newPlayer)
      })().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to initialize player'
        optionsRef.current.onError?.({ code: -1, message })
      })
    },
    [destroy, loadYouTubeAPI]
  )

  const getRequiredPlayer = useCallback((): YT.Player => {
    if (!playerRef.current) {
      throw new Error('Player not initialized')
    }
    return playerRef.current
  }, [])

  const play = useCallback((): void => {
    const readyPlayer = getRequiredPlayer()
    readyPlayer.playVideo()

    const time = readyPlayer.getCurrentTime()
    setCurrentTime(time)
    optionsRef.current.onTimeUpdate?.(time)
  }, [getRequiredPlayer])

  const pause = useCallback((): void => {
    const readyPlayer = getRequiredPlayer()
    readyPlayer.pauseVideo()
  }, [getRequiredPlayer])

  const seekTo = useCallback(
    (seconds: number): void => {
      const readyPlayer = getRequiredPlayer()
      readyPlayer.seekTo(seconds, true)
      setCurrentTime(seconds)
      optionsRef.current.onTimeUpdate?.(seconds)
    },
    [getRequiredPlayer]
  )

  const getCurrentTime = useCallback((): number => {
    const readyPlayer = getRequiredPlayer()
    return readyPlayer.getCurrentTime()
  }, [getRequiredPlayer])

  const getDuration = useCallback((): number => {
    const readyPlayer = getRequiredPlayer()
    return readyPlayer.getDuration()
  }, [getRequiredPlayer])

  useEffect(() => {
    if (!playerRef.current || !isReady) {
      return
    }

    const interval = setInterval(() => {
      if (!playerRef.current) {
        return
      }

      const time = playerRef.current.getCurrentTime()
      setCurrentTime(time)
      optionsRef.current.onTimeUpdate?.(time)
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [isReady])

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
