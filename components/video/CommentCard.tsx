'use client'

import type { KeyboardEvent, MouseEvent } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTime, formatTimecode } from '@/lib/utils/time'
import { cn } from '@/lib/utils/cn'
import type { Comment } from './CommentsList'

export interface CommentCardProps {
  comment: Comment
  isActive: boolean
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
  className?: string
}

export function CommentCard({
  comment,
  isActive,
  onClick,
  onEdit,
  onDelete,
  className,
}: CommentCardProps) {
  const handleActionClick = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
    event.stopPropagation()
    action()
  }

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <div
      className={cn(
        'cursor-pointer rounded-lg border p-3 transition-colors hover:bg-gray-50',
        isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200',
        className
      )}
      onClick={onClick}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Jump to ${formatTimecode(comment.timecodeSec)}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-sm text-gray-600">{formatTimecode(comment.timecodeSec)}</span>
          {comment.category ? <Badge variant="secondary">{comment.category}</Badge> : null}
          {comment.priority === 'HIGH' ? <Badge variant="error">HIGH</Badge> : null}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
            onClick={(event) => handleActionClick(event, onEdit)}
            aria-label="Edit comment"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-red-600"
            onClick={(event) => handleActionClick(event, onDelete)}
            aria-label="Delete comment"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-900">{comment.text}</p>

      {comment.authorName ? (
        <p className="mt-2 text-xs text-gray-500">
          {comment.authorName} · {formatRelativeTime(comment.createdAt)}
        </p>
      ) : null}
    </div>
  )
}
