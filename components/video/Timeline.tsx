'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { formatTimecode } from '@/lib/utils/time'

export interface TimelineProps {
  duration: number
  currentTime: number
  comments: TimelineComment[]
  onSeek: (seconds: number) => void
  className?: string
}

export interface TimelineComment {
  id: string
  timecodeSec: number
  text: string
}

type CommentGroup = {
  timecode: number
  comments: TimelineComment[]
  count: number
}

export function Timeline({ duration, currentTime, comments, onSeek, className }: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const calculatePosition = (timecode: number, totalDuration: number): number => {
    if (totalDuration <= 0 || !Number.isFinite(timecode)) {
      return 0
    }

    return Math.min(Math.max((timecode / totalDuration) * 100, 0), 100)
  }

  const calculateTimeFromClick = (
    clickX: number,
    containerWidth: number,
    totalDuration: number
  ): number => {
    if (containerWidth <= 0 || totalDuration <= 0) {
      return 0
    }

    const percent = Math.max(0, Math.min(1, clickX / containerWidth))
    return percent * totalDuration
  }

  const seekFromClientX = (clientX: number): void => {
    if (!timelineRef.current || duration <= 0) {
      return
    }

    const rect = timelineRef.current.getBoundingClientRect()
    const clickX = clientX - rect.left
    const seekTime = calculateTimeFromClick(clickX, rect.width, duration)
    onSeek(seekTime)
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    seekFromClientX(e.clientX)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) {
      return
    }

    setIsDragging(true)
    seekFromClientX(e.clientX)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return
    }

    seekFromClientX(e.clientX)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (duration <= 0) {
      return
    }

    const touch = e.touches[0]
    if (!touch) {
      return
    }

    setIsDragging(true)
    seekFromClientX(touch.clientX)
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return
    }

    const touch = e.touches[0]
    if (!touch) {
      return
    }

    seekFromClientX(touch.clientX)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  const handleMarkerClick = (timecode: number) => {
    onSeek(timecode)
  }

  const groupCommentsByTimecode = (items: TimelineComment[]): CommentGroup[] => {
    if (duration <= 0) {
      return []
    }

    const groups = new Map<number, TimelineComment[]>()

    items
      .filter((comment) => Number.isFinite(comment.timecodeSec))
      .filter((comment) => comment.timecodeSec >= 0 && comment.timecodeSec <= duration)
      .forEach((comment) => {
        const existing = groups.get(comment.timecodeSec) ?? []
        groups.set(comment.timecodeSec, [...existing, comment])
      })

    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([timecode, groupedComments]) => ({
        timecode,
        comments: groupedComments,
        count: groupedComments.length,
      }))
  }

  useEffect(() => {
    const stopDragging = () => setIsDragging(false)

    window.addEventListener('mouseup', stopDragging)
    window.addEventListener('touchend', stopDragging)

    return () => {
      window.removeEventListener('mouseup', stopDragging)
      window.removeEventListener('touchend', stopDragging)
    }
  }, [])

  const commentGroups = groupCommentsByTimecode(comments)
  const progressPercent = calculatePosition(currentTime, duration)

  if (duration <= 0) {
    return (
      <div className={cn('rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500', className)}>
        Video not loaded
      </div>
    )
  }

  return (
    <div className={cn('relative w-full', className)}>
      <div
        ref={timelineRef}
        data-testid="timeline-bar"
        className="relative h-3 w-full touch-none rounded-full bg-gray-200 cursor-pointer"
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="slider"
        aria-label="Video timeline"
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration)}
        aria-valuenow={Math.floor(Math.max(0, Math.min(currentTime, duration)))}
      >
        <div
          data-testid="progress-bar"
          className="absolute left-0 top-0 h-full rounded-full bg-blue-500 transition-[width]"
          style={{ width: `${progressPercent}%` }}
        />

        <div
          data-testid="current-indicator"
          className="pointer-events-none absolute -top-1 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white bg-blue-600 shadow"
          style={{ left: `${progressPercent}%` }}
        />

        {commentGroups.map((group) => {
          const markerTitle =
            group.count > 1
              ? `${formatTimecode(group.timecode)} (${group.count} comments)`
              : `${formatTimecode(group.timecode)}: ${group.comments[0]?.text ?? ''}`

          return (
            <button
              key={group.timecode}
              type="button"
              data-testid="comment-marker"
              title={markerTitle}
              className="absolute -top-0.5 z-10 h-4 w-4 -translate-x-1/2 rounded-full bg-amber-500 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-500"
              style={{ left: `${calculatePosition(group.timecode, duration)}%` }}
              onClick={(e) => {
                e.stopPropagation()
                handleMarkerClick(group.timecode)
              }}
              aria-label={`Jump to ${formatTimecode(group.timecode)}`}
            >
              {group.count > 1 ? (
                <span
                  data-testid="marker-badge"
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-semibold text-white"
                >
                  {group.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="mt-1 flex justify-between text-xs text-gray-500">
        <span>{formatTimecode(0)}</span>
        <span>{formatTimecode(duration)}</span>
      </div>
    </div>
  )
}
