/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useVoiceRecording } from '../useVoiceRecording'

interface MockSpeechChunk {
  text: string
  isFinal: boolean
}

class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = []

  continuous = true
  interimResults = true
  lang = 'en-US'
  onstart: ((event: Event) => void) | null = null
  onresult: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onend: ((event: Event) => void) | null = null

  start = vi.fn(() => {
    this.onstart?.(new Event('start'))
  })

  stop = vi.fn(() => {
    this.onend?.(new Event('end'))
  })

  constructor() {
    MockSpeechRecognition.instances.push(this)
  }

  emitResult(chunks: MockSpeechChunk[]): void {
    const results = chunks.map((chunk) => ({
      isFinal: chunk.isFinal,
      length: 1,
      0: {
        transcript: chunk.text,
      },
    }))

    const event = {
      resultIndex: 0,
      results,
    } as unknown as Event

    this.onresult?.(event)
  }

  emitError(code: string): void {
    const event = {
      error: code,
    } as unknown as Event

    this.onerror?.(event)
  }
}

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = []

  state: RecordingState = 'inactive'
  mimeType = 'audio/webm'
  ondataavailable: ((event: BlobEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onstop: ((event: Event) => void) | null = null

  readonly stream: MediaStream

  constructor(stream: MediaStream) {
    this.stream = stream
    MockMediaRecorder.instances.push(this)
  }

  start = vi.fn(() => {
    this.state = 'recording'
  })

  stop = vi.fn(() => {
    this.state = 'inactive'
    this.onstop?.(new Event('stop'))
  })

  pause = vi.fn(() => {
    this.state = 'paused'
  })

  resume = vi.fn(() => {
    this.state = 'recording'
  })

  emitData(blob: Blob): void {
    const event = {
      data: blob,
    } as BlobEvent

    this.ondataavailable?.(event)
  }
}

describe('useVoiceRecording', () => {
  const stopTrack = vi.fn()
  const getUserMediaMock = vi.fn<() => Promise<MediaStream>>()
  const originalUserAgent = window.navigator.userAgent

  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()

    MockSpeechRecognition.instances = []
    MockMediaRecorder.instances = []

    stopTrack.mockClear()

    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream

    getUserMediaMock.mockResolvedValue(stream)

    Object.defineProperty(global.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: getUserMediaMock,
      },
    })

    Object.defineProperty(global.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    })

    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: MockSpeechRecognition,
    })

    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      value: undefined,
    })

    Object.defineProperty(global, 'MediaRecorder', {
      configurable: true,
      value: MockMediaRecorder,
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Fallback transcript' }),
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    Object.defineProperty(global.navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    })
  })

  it('initialization: should start with default state', () => {
    const { result } = renderHook(() => useVoiceRecording())

    expect(result.current.status).toBe('idle')
    expect(result.current.transcript).toBe('')
    expect(result.current.interimTranscript).toBe('')
    expect(result.current.error).toBeNull()
  })

  it('support detection: should mark hook as supported', async () => {
    const { result } = renderHook(() => useVoiceRecording())

    await waitFor(() => {
      expect(result.current.isSupported).toBe(true)
    })
  })

  it('start: should request microphone and start speech recognition', async () => {
    const { result } = renderHook(() => useVoiceRecording())

    await act(async () => {
      await result.current.startRecording()
    })

    expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true })
    expect(MockSpeechRecognition.instances[0]?.start).toHaveBeenCalled()
    expect(result.current.status).toBe('recording')
  })

  it('stop: should stop recording and return to idle', async () => {
    const { result } = renderHook(() => useVoiceRecording())

    await act(async () => {
      await result.current.startRecording()
    })

    act(() => {
      result.current.stopRecording()
    })

    expect(MockSpeechRecognition.instances[0]?.stop).toHaveBeenCalled()
    await waitFor(() => {
      expect(result.current.status).toBe('idle')
    })
  })

  it('final result: should append final transcript and call callback', async () => {
    const onTranscript = vi.fn()
    const { result } = renderHook(() => useVoiceRecording({ onTranscript }))

    await act(async () => {
      await result.current.startRecording()
    })

    act(() => {
      MockSpeechRecognition.instances[0]?.emitResult([
        { text: 'This video needs more contrast', isFinal: true },
      ])
    })

    expect(result.current.transcript).toBe('This video needs more contrast')
    expect(onTranscript).toHaveBeenCalledWith('This video needs more contrast')
  })

  it('interim result: should set interim transcript without finalizing', async () => {
    const { result } = renderHook(() => useVoiceRecording())

    await act(async () => {
      await result.current.startRecording()
    })

    act(() => {
      MockSpeechRecognition.instances[0]?.emitResult([{ text: 'Draft text', isFinal: false }])
    })

    expect(result.current.interimTranscript).toBe('Draft text')
    expect(result.current.transcript).toBe('')
  })

  it('permission denied: should set access denied error', async () => {
    getUserMediaMock.mockRejectedValueOnce({ name: 'NotAllowedError' })

    const onError = vi.fn()
    const { result } = renderHook(() => useVoiceRecording({ onError }))

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.error?.message).toBe('Microphone access denied')
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Microphone access denied' }))
  })

  it('pause/resume: should pause and resume active recording', async () => {
    const { result } = renderHook(() => useVoiceRecording())

    await act(async () => {
      await result.current.startRecording()
    })

    act(() => {
      result.current.pauseRecording()
    })

    expect(result.current.status).toBe('paused')

    act(() => {
      result.current.resumeRecording()
    })

    expect(result.current.status).toBe('recording')
    expect(MockSpeechRecognition.instances[0]?.start).toHaveBeenCalledTimes(2)
  })

  it('clear: should clear transcript and interim transcript', async () => {
    const { result } = renderHook(() => useVoiceRecording())

    await act(async () => {
      await result.current.startRecording()
    })

    act(() => {
      MockSpeechRecognition.instances[0]?.emitResult([{ text: 'Final line', isFinal: true }])
      MockSpeechRecognition.instances[0]?.emitResult([{ text: 'Interim line', isFinal: false }])
    })

    act(() => {
      result.current.clearTranscript()
    })

    expect(result.current.transcript).toBe('')
    expect(result.current.interimTranscript).toBe('')
  })

  it('cleanup: should stop recognition on unmount', async () => {
    const { result, unmount } = renderHook(() => useVoiceRecording())

    await act(async () => {
      await result.current.startRecording()
    })

    unmount()

    expect(MockSpeechRecognition.instances[0]?.stop).toHaveBeenCalled()
  })

  it('fallback: should use MediaRecorder + Whisper on iOS', async () => {
    Object.defineProperty(global.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    })

    const onTranscript = vi.fn()
    const { result } = renderHook(() => useVoiceRecording({ onTranscript }))

    await act(async () => {
      await result.current.startRecording()
    })

    const recorder = MockMediaRecorder.instances[0]
    expect(recorder).toBeDefined()

    act(() => {
      recorder.emitData(new Blob(['voice']))
      result.current.stopRecording()
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/ai/transcribe-audio',
        expect.objectContaining({ method: 'POST' })
      )
    })

    await waitFor(() => {
      expect(result.current.transcript).toBe('Fallback transcript')
      expect(result.current.status).toBe('idle')
    })

    expect(onTranscript).toHaveBeenCalledWith('Fallback transcript')
  })

  it('auto-stop: should stop after silence timeout', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() =>
      useVoiceRecording({
        autoStop: true,
        autoStopTimeout: 3000,
      })
    )

    await act(async () => {
      await result.current.startRecording()
    })

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(MockSpeechRecognition.instances[0]?.stop).toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })
})
