'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { cn } from '@/lib/utils/cn'
import { formatTimecode } from '@/lib/utils/time'

export interface CommentFormProps {
  timecode: number
  existingComment?: {
    id: string
    text: string
  }
  onSave: (data: { text: string; timecodeSec: number }) => void | Promise<void>
  onCancel: () => void
  isLoading?: boolean
  className?: string
}

export function CommentForm({
  timecode,
  existingComment,
  onSave,
  onCancel,
  isLoading = false,
  className,
}: CommentFormProps) {
  const [text, setText] = useState(existingComment?.text ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setText(existingComment?.text ?? '')
  }, [existingComment?.id, existingComment?.text])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSave = async () => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) {
      return
    }

    await onSave({
      text: trimmed,
      timecodeSec: timecode,
    })
  }

  return (
    <div className={cn('rounded-lg border bg-white p-4 shadow-sm', className)}>
      <div className="mb-2 text-sm text-gray-600">At {formatTimecode(timecode)}</div>

      <textarea
        ref={textareaRef}
        className="min-h-[100px] w-full rounded border border-gray-300 p-2"
        placeholder="Add your comment..."
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoFocus
      />

      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!text.trim() || isLoading}
          className="gap-2"
        >
          {isLoading ? <LoadingSpinner size="sm" /> : null}
          Save
        </Button>
      </div>
    </div>
  )
}
