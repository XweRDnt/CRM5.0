/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { Timeline } from '../Timeline'
import { formatTimecode } from '@/lib/utils/time'

const mockComments = [
  { id: '1', timecodeSec: 15, text: 'Comment 1' },
  { id: '2', timecodeSec: 45, text: 'Comment 2' },
  { id: '3', timecodeSec: 90, text: 'Comment 3' },
]

const mockTimelineRect = (element: Element, left: number, width: number): void => {
  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => ({
      x: left,
      y: 0,
      left,
      top: 0,
      width,
      height: 8,
      right: left + width,
      bottom: 8,
      toJSON: () => ({}),
    }),
    configurable: true,
  })
}

describe('Timeline', () => {
  it('should render timeline bar', () => {
    render(<Timeline duration={120} currentTime={0} comments={[]} onSeek={vi.fn()} />)

    expect(screen.getByTestId('timeline-bar')).not.toBeNull()
  })

  it('should render progress bar based on currentTime', () => {
    const { container } = render(
      <Timeline duration={120} currentTime={60} comments={[]} onSeek={vi.fn()} />
    )

    const progressBar = container.querySelector('[data-testid="progress-bar"]') as HTMLElement
    expect(progressBar.style.width).toBe('50%')
  })

  it('should render comment markers at correct positions', () => {
    const { container } = render(
      <Timeline duration={120} currentTime={0} comments={mockComments} onSeek={vi.fn()} />
    )

    const markers = container.querySelectorAll('[data-testid="comment-marker"]')
    expect(markers).toHaveLength(3)

    expect((markers[0] as HTMLElement).style.left).toBe('12.5%')
    expect((markers[1] as HTMLElement).style.left).toBe('37.5%')
    expect((markers[2] as HTMLElement).style.left).toBe('75%')
  })

  it('should call onSeek when clicking on timeline', () => {
    const onSeek = vi.fn()
    const { container } = render(
      <Timeline duration={120} currentTime={0} comments={[]} onSeek={onSeek} />
    )

    const timeline = container.querySelector('[data-testid="timeline-bar"]') as HTMLElement
    mockTimelineRect(timeline, 0, 100)

    fireEvent.click(timeline, { clientX: 50 })

    expect(onSeek).toHaveBeenCalledWith(60)
  })

  it('should call onSeek when clicking on marker', () => {
    const onSeek = vi.fn()
    const { container } = render(
      <Timeline duration={120} currentTime={0} comments={mockComments} onSeek={onSeek} />
    )

    const markers = container.querySelectorAll('[data-testid="comment-marker"]')
    fireEvent.click(markers[1] as HTMLElement)

    expect(onSeek).toHaveBeenCalledWith(45)
  })

  it('should handle duration = 0', () => {
    render(<Timeline duration={0} currentTime={0} comments={[]} onSeek={vi.fn()} />)

    expect(screen.getByText('Video not loaded')).not.toBeNull()
  })

  it('should group multiple comments at same timecode', () => {
    const commentsAtSameTime = [
      { id: '1', timecodeSec: 30, text: 'Comment 1' },
      { id: '2', timecodeSec: 30, text: 'Comment 2' },
      { id: '3', timecodeSec: 30, text: 'Comment 3' },
    ]

    const { container } = render(
      <Timeline duration={120} currentTime={0} comments={commentsAtSameTime} onSeek={vi.fn()} />
    )

    const markers = container.querySelectorAll('[data-testid="comment-marker"]')
    expect(markers).toHaveLength(1)

    const badge = container.querySelector('[data-testid="marker-badge"]')
    expect(badge?.textContent).toBe('3')
  })

  it('should not render markers for comments beyond duration', () => {
    const commentsWithInvalid = [
      { id: '1', timecodeSec: 15, text: 'Valid' },
      { id: '2', timecodeSec: 150, text: 'Invalid (beyond duration)' },
    ]

    const { container } = render(
      <Timeline duration={120} currentTime={0} comments={commentsWithInvalid} onSeek={vi.fn()} />
    )

    const markers = container.querySelectorAll('[data-testid="comment-marker"]')
    expect(markers).toHaveLength(1)
  })

  it('should handle scrubbing (mouse drag)', () => {
    const onSeek = vi.fn()
    const { container } = render(
      <Timeline duration={120} currentTime={0} comments={[]} onSeek={onSeek} />
    )

    const timeline = container.querySelector('[data-testid="timeline-bar"]') as HTMLElement
    mockTimelineRect(timeline, 0, 100)

    fireEvent.mouseDown(timeline, { clientX: 25 })
    expect(onSeek).toHaveBeenCalledWith(30)

    fireEvent.mouseMove(timeline, { clientX: 50 })
    expect(onSeek).toHaveBeenCalledWith(60)

    fireEvent.mouseUp(timeline)
  })

  it('should format timecode correctly', () => {
    expect(formatTimecode(0)).toBe('0:00')
    expect(formatTimecode(90)).toBe('1:30')
    expect(formatTimecode(3661)).toBe('1:01:01')
  })

  it('should clamp seek time to timeline bounds', () => {
    const onSeek = vi.fn()
    const { container } = render(
      <Timeline duration={120} currentTime={0} comments={[]} onSeek={onSeek} />
    )

    const timeline = container.querySelector('[data-testid="timeline-bar"]') as HTMLElement
    mockTimelineRect(timeline, 10, 100)

    fireEvent.click(timeline, { clientX: -100 })
    fireEvent.click(timeline, { clientX: 999 })

    expect(onSeek).toHaveBeenNthCalledWith(1, 0)
    expect(onSeek).toHaveBeenNthCalledWith(2, 120)
  })
})
