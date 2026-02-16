import { useState, useCallback, useRef, useEffect } from 'react'

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'processing'

export interface UseVoiceRecordingOptions {
  onTranscript?: (text: string) => void
  onError?: (error: Error) => void
  onStatusChange?: (status: RecordingStatus) => void
  continuous?: boolean
  language?: string
  autoStop?: boolean
  autoStopTimeout?: number
}

export interface UseVoiceRecordingReturn {
  status: RecordingStatus
  transcript: string
  interimTranscript: string
  isSupported: boolean
  error: Error | null
  startRecording: () => Promise<void>
  stopRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
  clearTranscript: () => void
}

interface SpeechRecognitionAlternativeLike {
  transcript: string
}

interface SpeechRecognitionResultLike {
  isFinal: boolean
  length: number
  [index: number]: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: ((event: Event) => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: ((event: Event) => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

const DEFAULT_AUTO_STOP_TIMEOUT = 3000
const DEFAULT_LANGUAGE = 'en-US'

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

function canUseMediaRecorder(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  )
}

function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

function appendText(base: string, next: string): string {
  const normalized = normalizeText(next)
  if (!normalized) {
    return base
  }

  return base ? `${base} ${normalized}` : normalized
}

function mapMicrophoneError(error: unknown): Error {
  const domError = error as DOMException | undefined
  const name = domError?.name ?? ''

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return new Error('Microphone access denied')
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return new Error('No microphone detected')
  }

  return new Error('Unable to access microphone')
}

function mapSpeechError(errorCode: string): Error {
  if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
    return new Error('Microphone access denied')
  }

  if (errorCode === 'audio-capture') {
    return new Error('No microphone detected')
  }

  if (errorCode === 'network') {
    return new Error('Speech recognition service unavailable')
  }

  return new Error(`Speech recognition error: ${errorCode}`)
}

export function useVoiceRecording(
  options: UseVoiceRecordingOptions = {}
): UseVoiceRecordingReturn {
  const [status, setStatus] = useState<RecordingStatus>('idle')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const optionsRef = useRef(options)
  const statusRef = useRef<RecordingStatus>('idle')
  const transcriptRef = useRef('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isStoppingRef = useRef(false)
  const isPausedRef = useRef(false)
  const isUnmountedRef = useRef(false)

  const updateStatus = useCallback((nextStatus: RecordingStatus): void => {
    statusRef.current = nextStatus
    setStatus(nextStatus)
    optionsRef.current.onStatusChange?.(nextStatus)
  }, [])

  const setHookError = useCallback((nextError: Error): void => {
    setError(nextError)
    optionsRef.current.onError?.(nextError)
  }, [])

  const clearAutoStopTimer = useCallback((): void => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current)
      autoStopTimerRef.current = null
    }
  }, [])

  const stopActiveStream = useCallback((): void => {
    if (!mediaStreamRef.current) {
      return
    }

    mediaStreamRef.current.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
  }, [])

  const stopRecording = useCallback((): void => {
    clearAutoStopTimer()
    isStoppingRef.current = true

    if (recognitionRef.current) {
      if (statusRef.current !== 'idle') {
        updateStatus('processing')
      }
      recognitionRef.current.stop()
      return
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      updateStatus('processing')
      mediaRecorderRef.current.stop()
      return
    }

    stopActiveStream()
    if (statusRef.current !== 'idle') {
      updateStatus('idle')
    }
  }, [clearAutoStopTimer, stopActiveStream, updateStatus])

  const resetAutoStopTimer = useCallback((): void => {
    clearAutoStopTimer()

    if (!optionsRef.current.autoStop || statusRef.current !== 'recording') {
      return
    }

    const timeout = optionsRef.current.autoStopTimeout ?? DEFAULT_AUTO_STOP_TIMEOUT
    autoStopTimerRef.current = setTimeout(() => {
      stopRecording()
    }, timeout)
  }, [clearAutoStopTimer, stopRecording])

  const handleFinalTranscript = useCallback((finalText: string): void => {
    const nextTranscript = appendText(transcriptRef.current, finalText)
    transcriptRef.current = nextTranscript
    setTranscript(nextTranscript)

    if (nextTranscript) {
      optionsRef.current.onTranscript?.(nextTranscript)
    }
  }, [])

  const transcribeWithWhisper = useCallback(
    async (audioBlob: Blob): Promise<void> => {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      try {
        const response = await fetch('/api/ai/transcribe-audio', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error('Transcription API unavailable')
        }

        const payload = (await response.json()) as { text?: string; transcript?: string }
        const text = normalizeText(payload.text ?? payload.transcript ?? '')

        if (!text) {
          throw new Error('Transcription API unavailable')
        }

        handleFinalTranscript(text)
        setInterimTranscript('')
      } catch {
        setHookError(new Error('Transcription API unavailable'))
      }
    },
    [handleFinalTranscript, setHookError]
  )

  const startRecording = useCallback(async (): Promise<void> => {
    if (statusRef.current === 'recording' || statusRef.current === 'processing') {
      return
    }

    if (!isSupported) {
      setHookError(new Error('Voice recording is not supported in this browser'))
      return
    }

    setError(null)
    setInterimTranscript('')
    isStoppingRef.current = false
    isPausedRef.current = false

    let stream: MediaStream

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (recordingError) {
      setHookError(mapMicrophoneError(recordingError))
      return
    }

    const speechConstructor = getSpeechRecognitionConstructor()
    const shouldUseSpeechApi = !!speechConstructor && !isIOSDevice()

    if (shouldUseSpeechApi && speechConstructor) {
      stream.getTracks().forEach((track) => track.stop())

      const recognition = new speechConstructor()
      recognition.continuous = optionsRef.current.continuous ?? true
      recognition.interimResults = true
      recognition.lang = optionsRef.current.language ?? DEFAULT_LANGUAGE

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let finalBuffer = ''
        let interimBuffer = ''

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index]
          const text = result[0]?.transcript ?? ''

          if (result.isFinal) {
            finalBuffer = appendText(finalBuffer, text)
          } else {
            interimBuffer = appendText(interimBuffer, text)
          }
        }

        if (finalBuffer) {
          handleFinalTranscript(finalBuffer)
          setInterimTranscript('')
        }

        if (interimBuffer) {
          setInterimTranscript(normalizeText(interimBuffer))
        }

        resetAutoStopTimer()
      }

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        setHookError(mapSpeechError(event.error))
      }

      recognition.onend = () => {
        setInterimTranscript('')

        if (isUnmountedRef.current) {
          return
        }

        if (isPausedRef.current) {
          updateStatus('paused')
          return
        }

        if (isStoppingRef.current) {
          recognitionRef.current = null
          updateStatus('idle')
          return
        }

        if (statusRef.current === 'recording' && (optionsRef.current.continuous ?? true)) {
          recognition.start()
          return
        }

        recognitionRef.current = null
        updateStatus('idle')
      }

      recognitionRef.current = recognition
      updateStatus('recording')
      resetAutoStopTimer()
      recognition.start()
      return
    }

    mediaStreamRef.current = stream
    audioChunksRef.current = []

    const recorder = new MediaRecorder(stream)
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data)
      }
      resetAutoStopTimer()
    }

    recorder.onerror = () => {
      setHookError(new Error('Audio recording failed'))
    }

    recorder.onstop = async () => {
      const chunks = audioChunksRef.current
      audioChunksRef.current = []

      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
      mediaRecorderRef.current = null
      stopActiveStream()

      if (isUnmountedRef.current) {
        return
      }

      if (blob.size === 0) {
        updateStatus('idle')
        return
      }

      updateStatus('processing')
      await transcribeWithWhisper(blob)
      updateStatus('idle')
    }

    updateStatus('recording')
    resetAutoStopTimer()
    recorder.start(250)
  }, [
    handleFinalTranscript,
    isSupported,
    resetAutoStopTimer,
    setHookError,
    stopActiveStream,
    transcribeWithWhisper,
    updateStatus,
  ])

  const pauseRecording = useCallback((): void => {
    if (statusRef.current !== 'recording') {
      return
    }

    clearAutoStopTimer()
    isPausedRef.current = true

    if (recognitionRef.current) {
      recognitionRef.current.stop()
      updateStatus('paused')
      return
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause()
      updateStatus('paused')
    }
  }, [clearAutoStopTimer, updateStatus])

  const resumeRecording = useCallback((): void => {
    if (statusRef.current !== 'paused') {
      return
    }

    isPausedRef.current = false
    isStoppingRef.current = false

    if (recognitionRef.current) {
      recognitionRef.current.start()
      updateStatus('recording')
      resetAutoStopTimer()
      return
    }

    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume()
      updateStatus('recording')
      resetAutoStopTimer()
    }
  }, [resetAutoStopTimer, updateStatus])

  const clearTranscript = useCallback((): void => {
    transcriptRef.current = ''
    setTranscript('')
    setInterimTranscript('')
  }, [])

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])

  useEffect(() => {
    const supported = !!getSpeechRecognitionConstructor() || canUseMediaRecorder()
    setIsSupported(supported)
  }, [])

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true
      clearAutoStopTimer()
      recognitionRef.current?.stop()

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }

      recognitionRef.current = null
      mediaRecorderRef.current = null
      audioChunksRef.current = []
      stopActiveStream()
    }
  }, [clearAutoStopTimer, stopActiveStream])

  return {
    status,
    transcript,
    interimTranscript,
    isSupported,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearTranscript,
  }
}
