/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useYouTubePlayer } from '../useYouTubePlayer'

const mockPlayer = {
  playVideo: vi.fn(),
  pauseVideo: vi.fn(),
  seekTo: vi.fn(),
  getCurrentTime: vi.fn(() => 0),
  getDuration: vi.fn(() => 100),
  getPlayerState: vi.fn(() => -1),
  destroy: vi.fn(),
} as unknown as YT.Player

beforeEach(() => {
  const playerConstructorMock = vi.fn(function (
    this: unknown,
    elementId: string | HTMLElement,
    options: YT.PlayerOptions
  ) {
    void elementId
    setTimeout(() => {
      options.events?.onReady?.({ target: mockPlayer })
    }, 100)
    return mockPlayer
  })

  global.window.YT = {
    Player: playerConstructorMock as unknown as typeof YT.Player,
    PlayerState: {
      UNSTARTED: -1,
      ENDED: 0,
      PLAYING: 1,
      PAUSED: 2,
      BUFFERING: 3,
      CUED: 5,
    },
  } as unknown as typeof YT

  vi.clearAllMocks()
})

afterEach(() => {
  delete (global.window as Window & { YT?: typeof YT }).YT
})

describe('useYouTubePlayer', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useYouTubePlayer())

    expect(result.current.player).toBeNull()
    expect(result.current.isReady).toBe(false)
    expect(result.current.currentTime).toBe(0)
    expect(result.current.duration).toBe(0)
    expect(result.current.isPlaying).toBe(false)
  })

  it('should initialize YouTube player', async () => {
    const onReady = vi.fn()
    const { result } = renderHook(() => useYouTubePlayer({ onReady }))

    act(() => {
      result.current.initializePlayer('player', 'dQw4w9WgXcQ')
    })

    await waitFor(() => {
      expect(result.current.isReady).toBe(true)
    })

    expect(window.YT.Player).toHaveBeenCalledWith(
      'player',
      expect.objectContaining({
        videoId: 'dQw4w9WgXcQ',
      })
    )
    expect(onReady).toHaveBeenCalled()
  })

  it('should play video', async () => {
    const { result } = renderHook(() => useYouTubePlayer())

    act(() => {
      result.current.initializePlayer('player', 'dQw4w9WgXcQ')
    })

    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => {
      result.current.play()
    })

    expect(mockPlayer.playVideo).toHaveBeenCalled()
  })

  it('should pause video', async () => {
    const { result } = renderHook(() => useYouTubePlayer())

    act(() => {
      result.current.initializePlayer('player', 'dQw4w9WgXcQ')
    })

    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => {
      result.current.pause()
    })

    expect(mockPlayer.pauseVideo).toHaveBeenCalled()
  })

  it('should seek to specific time', async () => {
    const { result } = renderHook(() => useYouTubePlayer())

    act(() => {
      result.current.initializePlayer('player', 'dQw4w9WgXcQ')
    })

    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => {
      result.current.seekTo(45)
    })

    expect(mockPlayer.seekTo).toHaveBeenCalledWith(45, true)
  })

  it('should get current time', async () => {
    vi.mocked(mockPlayer.getCurrentTime).mockReturnValue(30)
    const { result } = renderHook(() => useYouTubePlayer())

    act(() => {
      result.current.initializePlayer('player', 'dQw4w9WgXcQ')
    })

    await waitFor(() => expect(result.current.isReady).toBe(true))

    const time = result.current.getCurrentTime()
    expect(time).toBe(30)
  })

  it('should get duration', async () => {
    vi.mocked(mockPlayer.getDuration).mockReturnValue(120)
    const { result } = renderHook(() => useYouTubePlayer())

    act(() => {
      result.current.initializePlayer('player', 'dQw4w9WgXcQ')
    })

    await waitFor(() => expect(result.current.isReady).toBe(true))

    const duration = result.current.getDuration()
    expect(duration).toBe(120)
  })

  it('should destroy player on cleanup', async () => {
    const { result, unmount } = renderHook(() => useYouTubePlayer())

    act(() => {
      result.current.initializePlayer('player', 'dQw4w9WgXcQ')
    })

    await waitFor(() => expect(result.current.isReady).toBe(true))

    unmount()

    expect(mockPlayer.destroy).toHaveBeenCalled()
  })

  it('should handle errors gracefully', async () => {
    const onError = vi.fn()
    const { result } = renderHook(() => useYouTubePlayer({ onError }))

    global.window.YT.Player = vi.fn(function (
      this: unknown,
      elementId: string | HTMLElement,
      options: YT.PlayerOptions
    ) {
      void elementId
      setTimeout(() => {
        options.events?.onError?.({ target: mockPlayer, data: 2 })
      }, 100)
      return mockPlayer
    }) as unknown as typeof YT.Player

    act(() => {
      result.current.initializePlayer('player', 'invalid-id')
    })

    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })
  })

  it('should update currentTime periodically', async () => {
    const onTimeUpdate = vi.fn()
    let timeValue = 0
    vi.mocked(mockPlayer.getCurrentTime).mockImplementation(() => timeValue)

    const { result } = renderHook(() => useYouTubePlayer({ onTimeUpdate }))

    act(() => {
      result.current.initializePlayer('player', 'dQw4w9WgXcQ')
    })

    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => {
      timeValue = 5
      result.current.play()
    })

    await waitFor(() => {
      expect(onTimeUpdate).toHaveBeenCalledWith(5)
    })
  })

  it('should throw error when calling methods before initialization', () => {
    const { result } = renderHook(() => useYouTubePlayer())

    expect(() => result.current.play()).toThrow()
    expect(() => result.current.pause()).toThrow()
    expect(() => result.current.seekTo(10)).toThrow()
  })
})
