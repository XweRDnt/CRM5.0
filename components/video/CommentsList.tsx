'use client'

import { useMemo, useState } from 'react'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils/cn'
import { CommentCard } from './CommentCard'

export interface Comment {
  id: string
  timecodeSec: number
  text: string
  category?: 'DESIGN' | 'AUDIO' | 'CONTENT' | 'TECHNICAL' | 'OTHER'
  priority?: 'HIGH' | 'MEDIUM' | 'LOW'
  authorName?: string
  createdAt: Date
}

export interface CommentsListProps {
  comments: Comment[]
  currentTime: number
  onCommentClick: (timecode: number) => void
  onEdit: (commentId: string) => void
  onDelete: (commentId: string) => void
  className?: string
}

export function CommentsList({
  comments,
  currentTime,
  onCommentClick,
  onEdit,
  onDelete,
  className,
}: CommentsListProps) {
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | NonNullable<Comment['category']>
  >('all')

  const filteredComments = useMemo(() => {
    return comments
      .filter((comment) => categoryFilter === 'all' || comment.category === categoryFilter)
      .sort((a, b) => a.timecodeSec - b.timecodeSec)
  }, [categoryFilter, comments])

  const isCommentActive = (comment: Comment): boolean => {
    return Math.abs(comment.timecodeSec - currentTime) <= 5
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="border-b p-4">
        <h3 className="mb-2 font-semibold">Comments ({comments.length})</h3>
        <select
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          value={categoryFilter}
          onChange={(event) =>
            setCategoryFilter(event.target.value as 'all' | NonNullable<Comment['category']>)
          }
          aria-label="Filter comments by category"
        >
          <option value="all">All</option>
          <option value="DESIGN">Design</option>
          <option value="AUDIO">Audio</option>
          <option value="CONTENT">Content</option>
          <option value="TECHNICAL">Technical</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {filteredComments.length === 0 ? (
          <EmptyState title="No comments yet" description="Add feedback to start the review." />
        ) : (
          filteredComments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              isActive={isCommentActive(comment)}
              onClick={() => onCommentClick(comment.timecodeSec)}
              onEdit={() => onEdit(comment.id)}
              onDelete={() => onDelete(comment.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
