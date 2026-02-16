interface Window {
  YT?: typeof YT
  onYouTubeIframeAPIReady?: () => void
}

declare namespace YT {
  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }

  interface PlayerError {
    code: number
    message: string
  }

  interface PlayerOptions {
    height?: string | number
    width?: string | number
    videoId: string
    events?: {
      onReady?: (event: PlayerEvent) => void
      onStateChange?: (event: OnStateChangeEvent) => void
      onError?: (event: OnErrorEvent) => void
    }
    playerVars?: PlayerVars
  }

  interface PlayerVars {
    autoplay?: 0 | 1
    controls?: 0 | 1
    modestbranding?: 0 | 1
    rel?: 0 | 1
    fs?: 0 | 1
  }

  interface PlayerEvent {
    target: Player
  }

  interface OnStateChangeEvent extends PlayerEvent {
    data: PlayerState
  }

  interface OnErrorEvent extends PlayerEvent {
    data: number
  }

  class Player {
    constructor(elementId: string | HTMLElement, options: PlayerOptions)
    playVideo(): void
    pauseVideo(): void
    seekTo(seconds: number, allowSeekAhead: boolean): void
    getCurrentTime(): number
    getDuration(): number
    getPlayerState(): PlayerState
    destroy(): void
  }
}

