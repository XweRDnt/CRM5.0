'use client'

import { Mic, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface VoiceInputProps {
  transcript: string
  isRecording: boolean
  isSupported: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  onTranscriptChange: (text: string) => void
  onClear: () => void
  className?: string
}

export function VoiceInput({
  transcript,
  isRecording,
  isSupported,
  onStartRecording,
  onStopRecording,
  onTranscriptChange,
  onClear,
  className,
}: VoiceInputProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          title="Hold to record voice note"
          className={cn(
            'flex items-center gap-2 rounded-lg border px-4 py-2 transition-colors',
            isRecording ? 'border-red-500 bg-red-50 text-red-700' : 'hover:bg-gray-50'
          )}
          onMouseDown={onStartRecording}
          onMouseUp={onStopRecording}
          onMouseLeave={onStopRecording}
          onTouchStart={onStartRecording}
          onTouchEnd={onStopRecording}
          disabled={!isSupported}
        >
          <Mic className={cn('h-4 w-4', isRecording && 'animate-pulse')} aria-hidden />
          {isRecording ? 'Recording...' : 'Hold to Record'}
        </button>

        {!isSupported ? (
          <span className="text-sm text-gray-500">Voice input not supported in this browser</span>
        ) : null}
      </div>

      {transcript ? (
        <div className="relative">
          <textarea
            className="min-h-[80px] w-full rounded border border-gray-300 p-2 pr-10"
            value={transcript}
            onChange={(event) => onTranscriptChange(event.target.value)}
            placeholder="Your voice input will appear here..."
          />
          <button
            type="button"
            className="absolute right-2 top-2 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            onClick={onClear}
            aria-label="Clear transcript"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}

      <p className="text-xs text-gray-500">Tip: hold the button while speaking, then release.</p>
    </div>
  )
}
