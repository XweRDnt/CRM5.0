/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { YouTubePlayer } from '../YouTubePlayer'
import type { YouTubePlayerRef } from '../YouTubePlayer'
import { useYouTubePlayer } from '@/lib/hooks/useYouTubePlayer'

vi.mock('@/lib/hooks/useYouTubePlayer', () => ({
  useYouTubePlayer: vi.fn(),
}))

const mockedUseYouTubePlayer = vi.mocked(useYouTubePlayer)

describe('YouTubePlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockedUseYouTubePlayer.mockReturnValue({
      player: null,
      isReady: false,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      initializePlayer: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      seekTo: vi.fn(),
      getCurrentTime: vi.fn(() => 0),
      getDuration: vi.fn(() => 0),
      destroy: vi.fn(),
    })
  })

  it('should render loading state initially', () => {
    render(<YouTubePlayer videoUrl="https://youtube.com/watch?v=test123abcd" />)
    expect(screen.queryByText(/loading/i)).not.toBeNull()
  })

  it('should extract videoId from YouTube URL', () => {
    const initializePlayer = vi.fn()
    mockedUseYouTubePlayer.mockReturnValue({
      player: null,
      isReady: false,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      initializePlayer,
      play: vi.fn(),
      pause: vi.fn(),
      seekTo: vi.fn(),
      getCurrentTime: vi.fn(() => 0),
      getDuration: vi.fn(() => 0),
      destroy: vi.fn(),
    })

    render(<YouTubePlayer videoUrl="https://youtube.com/watch?v=dQw4w9WgXcQ" />)
    expect(initializePlayer).toHaveBeenCalledWith(expect.stringMatching(/^youtube-player-/), 'dQw4w9WgXcQ')
  })

  it('should accept raw videoId', () => {
    const initializePlayer = vi.fn()
    mockedUseYouTubePlayer.mockReturnValue({
      player: null,
      isReady: false,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      initializePlayer,
      play: vi.fn(),
      pause: vi.fn(),
      seekTo: vi.fn(),
      getCurrentTime: vi.fn(() => 0),
      getDuration: vi.fn(() => 0),
      destroy: vi.fn(),
    })

    render(<YouTubePlayer videoUrl="dQw4w9WgXcQ" />)
    expect(initializePlayer).toHaveBeenCalledWith(expect.stringMatching(/^youtube-player-/), 'dQw4w9WgXcQ')
  })

  it('should show error for invalid URL', () => {
    render(<YouTubePlayer videoUrl="invalid" />)
    expect(screen.queryByText(/invalid youtube url/i)).not.toBeNull()
  })

  it('should call onError for invalid URL', async () => {
    const onError = vi.fn()
    render(<YouTubePlayer videoUrl="invalid" onError={onError} />)

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Invalid YouTube URL')
    })
  })

  it('should render player when ready', async () => {
    mockedUseYouTubePlayer.mockReturnValue({
      player: null,
      isReady: true,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      initializePlayer: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      seekTo: vi.fn(),
      getCurrentTime: vi.fn(() => 0),
      getDuration: vi.fn(() => 0),
      destroy: vi.fn(),
    })

    const { container } = render(<YouTubePlayer videoUrl="https://youtube.com/watch?v=dQw4w9WgXcQ" />)

    await waitFor(() => {
      expect(container.querySelector('[id^="youtube-player-"]')).not.toBeNull()
    })
  })

  it('should call callbacks', async () => {
    const onReady = vi.fn()
    let capturedOptions: {
      onReady?: () => void
      onTimeUpdate?: (seconds: number) => void
    } = {}

    mockedUseYouTubePlayer.mockImplementation((options = {}) => {
      capturedOptions = options
      return {
        player: null,
        isReady: true,
        currentTime: 10,
        duration: 120,
        isPlaying: false,
        initializePlayer: vi.fn(),
        play: vi.fn(),
        pause: vi.fn(),
        seekTo: vi.fn(),
        getCurrentTime: vi.fn(() => 10),
        getDuration: vi.fn(() => 120),
        destroy: vi.fn(),
      }
    })

    const onTimeUpdate = vi.fn()

    render(
      <YouTubePlayer
        videoUrl="https://youtube.com/watch?v=dQw4w9WgXcQ"
        onReady={onReady}
        onTimeUpdate={onTimeUpdate}
      />
    )

    await waitFor(() => {
      capturedOptions.onReady?.()
      capturedOptions.onTimeUpdate?.(10)
      expect(onReady).toHaveBeenCalled()
      expect(onTimeUpdate).toHaveBeenCalledWith(10)
    })
  })

  it('should forward play and pause callbacks from player state', async () => {
    const onPlay = vi.fn()
    const onPause = vi.fn()
    let capturedOptions: {
      onStateChange?: (state: YT.PlayerState) => void
    } = {}

    mockedUseYouTubePlayer.mockImplementation((options = {}) => {
      capturedOptions = options
      return {
        player: null,
        isReady: true,
        currentTime: 0,
        duration: 0,
        isPlaying: false,
        initializePlayer: vi.fn(),
        play: vi.fn(),
        pause: vi.fn(),
        seekTo: vi.fn(),
        getCurrentTime: vi.fn(() => 0),
        getDuration: vi.fn(() => 0),
        destroy: vi.fn(),
      }
    })

    render(
      <YouTubePlayer
        videoUrl="https://youtube.com/watch?v=dQw4w9WgXcQ"
        onPlay={onPlay}
        onPause={onPause}
      />
    )

    await waitFor(() => {
      capturedOptions.onStateChange?.(1)
      capturedOptions.onStateChange?.(2)
      expect(onPlay).toHaveBeenCalled()
      expect(onPause).toHaveBeenCalled()
    })
  })

  it('should map unavailable player errors', async () => {
    const onError = vi.fn()
    let capturedOptions: {
      onError?: (error: YT.PlayerError) => void
    } = {}

    mockedUseYouTubePlayer.mockImplementation((options = {}) => {
      capturedOptions = options
      return {
        player: null,
        isReady: false,
        currentTime: 0,
        duration: 0,
        isPlaying: false,
        initializePlayer: vi.fn(),
        play: vi.fn(),
        pause: vi.fn(),
        seekTo: vi.fn(),
        getCurrentTime: vi.fn(() => 0),
        getDuration: vi.fn(() => 0),
        destroy: vi.fn(),
      }
    })

    render(<YouTubePlayer videoUrl="dQw4w9WgXcQ" onError={onError} />)

    await waitFor(() => {
      capturedOptions.onError?.({ code: 100, message: 'x' })
      expect(onError).toHaveBeenCalledWith('Video unavailable')
      expect(screen.queryByText(/video unavailable/i)).not.toBeNull()
    })
  })

  it('should expose ref methods', () => {
    const play = vi.fn()
    const pause = vi.fn()
    const seekTo = vi.fn()
    const getCurrentTime = vi.fn(() => 12)
    const getDuration = vi.fn(() => 45)

    mockedUseYouTubePlayer.mockReturnValue({
      player: null,
      isReady: true,
      currentTime: 12,
      duration: 45,
      isPlaying: false,
      initializePlayer: vi.fn(),
      play,
      pause,
      seekTo,
      getCurrentTime,
      getDuration,
      destroy: vi.fn(),
    })

    const ref = createRef<YouTubePlayerRef>()
    render(<YouTubePlayer ref={ref} videoUrl="https://youtube.com/watch?v=dQw4w9WgXcQ" />)

    ref.current?.play()
    ref.current?.pause()
    ref.current?.seekTo(33)

    expect(play).toHaveBeenCalled()
    expect(pause).toHaveBeenCalled()
    expect(seekTo).toHaveBeenCalledWith(33)
    expect(ref.current?.getCurrentTime()).toBe(12)
    expect(ref.current?.getDuration()).toBe(45)
    expect(ref.current?.isReady).toBe(true)
  })

  it('should keep ref methods safe when not ready', () => {
    const play = vi.fn()
    const pause = vi.fn()
    const seekTo = vi.fn()

    mockedUseYouTubePlayer.mockReturnValue({
      player: null,
      isReady: false,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      initializePlayer: vi.fn(),
      play,
      pause,
      seekTo,
      getCurrentTime: vi.fn(() => 0),
      getDuration: vi.fn(() => 0),
      destroy: vi.fn(),
    })

    const ref = createRef<YouTubePlayerRef>()
    render(<YouTubePlayer ref={ref} videoUrl="dQw4w9WgXcQ" />)

    ref.current?.play()
    ref.current?.pause()
    ref.current?.seekTo(10)

    expect(play).not.toHaveBeenCalled()
    expect(pause).not.toHaveBeenCalled()
    expect(seekTo).not.toHaveBeenCalled()
    expect(ref.current?.getCurrentTime()).toBe(0)
    expect(ref.current?.getDuration()).toBe(0)
    expect(ref.current?.isReady).toBe(false)
  })

  it('should render responsive 16:9 container and merge className', () => {
    const { container } = render(<YouTubePlayer videoUrl="dQw4w9WgXcQ" className="custom-player" />)
    expect(container.querySelector('.custom-player')).not.toBeNull()
    expect(container.querySelector('.aspect-video')).not.toBeNull()
  })

  it('should reinitialize on URL change', () => {
    const initializePlayer = vi.fn()
    mockedUseYouTubePlayer.mockReturnValue({
      player: null,
      isReady: false,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      initializePlayer,
      play: vi.fn(),
      pause: vi.fn(),
      seekTo: vi.fn(),
      getCurrentTime: vi.fn(() => 0),
      getDuration: vi.fn(() => 0),
      destroy: vi.fn(),
    })

    const { rerender } = render(<YouTubePlayer videoUrl="https://youtube.com/watch?v=dQw4w9WgXcQ" />)
    rerender(<YouTubePlayer videoUrl="https://youtu.be/9bZkp7q19f0" />)

    expect(initializePlayer).toHaveBeenCalledWith(expect.stringMatching(/^youtube-player-/), 'dQw4w9WgXcQ')
    expect(initializePlayer).toHaveBeenCalledWith(expect.stringMatching(/^youtube-player-/), '9bZkp7q19f0')
  })
})
