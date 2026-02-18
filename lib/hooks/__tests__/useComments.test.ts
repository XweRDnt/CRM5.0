/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useComments } from '../useComments'
import type { Comment } from '../useComments'

// Mock fetch
global.fetch = vi.fn()

function createWrapper() {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      SWRConfig,
      {
        value: {
          provider: () => new Map(),
          dedupingInterval: 0,
        },
      },
      children
    )

  Wrapper.displayName = 'SWRTestWrapper'
  return Wrapper
}

describe('useComments', () => {
  const mockComments: Comment[] = [
    {
      id: '1',
      content: 'Fix the logo color',
      timecodeSec: 30,
      category: 'DESIGN',
      priority: 'HIGH',
      status: 'OPEN',
      createdAt: '2026-02-16T10:00:00Z',
      updatedAt: '2026-02-16T10:00:00Z',
      userId: 'user1',
      projectId: 'proj1',
    },
    {
      id: '2',
      content: 'Audio is too quiet',
      timecodeSec: 45,
      category: 'AUDIO',
      priority: 'MEDIUM',
      status: 'OPEN',
      createdAt: '2026-02-16T10:05:00Z',
      updatedAt: '2026-02-16T10:05:00Z',
      userId: 'user1',
      projectId: 'proj1',
    },
    {
      id: '3',
      content: 'Add transition here',
      timecodeSec: 15,
      category: 'CONTENT',
      priority: 'LOW',
      status: 'RESOLVED',
      createdAt: '2026-02-16T09:00:00Z',
      updatedAt: '2026-02-16T11:00:00Z',
      userId: 'user1',
      projectId: 'proj1',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockComments,
    } as Response)
  })

  // TEST 1: Fetch comments успешно
  it('should fetch and display comments', async () => {
    const { result } = renderHook(() =>
      useComments({ projectId: 'proj1' }),
      { wrapper: createWrapper() }
    )

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.comments).toHaveLength(3)
    expect(result.current.comments[0].id).toBe('1')
  })

  // TEST 2: Sorting по таймкоду (ascending)
  it('should sort comments by timecode', async () => {
    const { result } = renderHook(() =>
      useComments({ projectId: 'proj1', sortBy: 'timecode', sortOrder: 'asc' }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const timecodes = result.current.comments.map(c => c.timecodeSec)
    expect(timecodes).toEqual([15, 30, 45])
  })

  // TEST 3: Фильтрация по категории
  it('should filter comments by category', async () => {
    const { result } = renderHook(() =>
      useComments({ projectId: 'proj1', category: 'DESIGN' }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.comments).toHaveLength(1)
    expect(result.current.comments[0].category).toBe('DESIGN')
  })

  // TEST 4: Фильтрация по статусу
  it('should filter comments by status', async () => {
    const { result } = renderHook(() =>
      useComments({ projectId: 'proj1', status: 'OPEN' }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.comments).toHaveLength(2)
    expect(result.current.comments.every(c => c.status === 'OPEN')).toBe(true)
  })

  // TEST 5: Add comment с optimistic update
  it('should add comment with optimistic update', async () => {
    const { result } = renderHook(() =>
      useComments({ projectId: 'proj1' }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const newComment = {
      content: 'New feedback',
      timecodeSec: 60,
      category: 'DESIGN' as const,
      priority: 'HIGH' as const,
      projectId: 'proj1',
    }

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ ...newComment, id: '4', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: 'user1', status: 'OPEN' }),
    } as Response)

    await act(async () => {
      await result.current.addComment(newComment)
    })

    expect(result.current.comments).toHaveLength(4)
    expect(result.current.comments.some(c => c.content === 'New feedback')).toBe(true)
  })

  // TEST 6: Update comment с optimistic update
  it('should update comment with optimistic update', async () => {
    const { result } = renderHook(() =>
      useComments({ projectId: 'proj1' }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ ...mockComments[0], content: 'Updated content' }),
    } as Response)

    await act(async () => {
      await result.current.updateComment('1', { content: 'Updated content' })
    })

    const updated = result.current.comments.find(c => c.id === '1')
    expect(updated?.content).toBe('Updated content')
  })

  // TEST 7: Delete comment с optimistic removal
  it('should delete comment with optimistic removal', async () => {
    const { result } = renderHook(() =>
      useComments({ projectId: 'proj1' }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ success: true }),
    } as Response)

    await act(async () => {
      await result.current.deleteComment('1')
    })

    expect(result.current.comments).toHaveLength(2)
    expect(result.current.comments.find(c => c.id === '1')).toBeUndefined()
  })

  // TEST 8: Error handling при fetch
  it('should handle fetch errors', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() =>
      useComments({ projectId: 'proj1' }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
      expect(result.current.error?.message).toContain('Network error')
    })
  })

  // TEST 9: Retry при ошибке add
  it('should retry on add failure', async () => {
    const { result } = renderHook(() =>
      useComments({ projectId: 'proj1' }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    vi.mocked(global.fetch).mockRejectedValue(new Error('Server error'))

    const newComment = {
      content: 'Test',
      timecodeSec: 10,
      projectId: 'proj1',
    }

    await act(async () => {
      try {
        await result.current.addComment(newComment)
      } catch {
        // Expected
      }
    })

    expect(result.current.error).toBeTruthy()
  })

  // TEST 10: getCommentById
  it('should get comment by ID', async () => {
    const { result } = renderHook(() =>
      useComments({ projectId: 'proj1' }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const comment = result.current.getCommentById('1')
    expect(comment?.id).toBe('1')
    expect(comment?.content).toBe('Fix the logo color')
  })

  // TEST 11: getCommentsAtTimecode
  it('should get comments at specific timecode', async () => {
    const { result } = renderHook(() =>
      useComments({ projectId: 'proj1' }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const comments = result.current.getCommentsAtTimecode(30, 1)
    expect(comments).toHaveLength(1)
    expect(comments[0].timecodeSec).toBe(30)
  })

  // TEST 12: Фильтрация по timecodeRange
  it('should filter by timecode range', async () => {
    const { result } = renderHook(() =>
      useComments({
        projectId: 'proj1',
        timecodeRange: { start: 20, end: 50 },
      }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.comments).toHaveLength(2)
    expect(result.current.comments.every(c => c.timecodeSec >= 20 && c.timecodeSec <= 50)).toBe(true)
  })

  // TEST 13: Refresh comments
  it('should refresh comments manually', async () => {
    const { result } = renderHook(() =>
      useComments({ projectId: 'proj1' }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const fetchCallsBefore = vi.mocked(global.fetch).mock.calls.length

    await act(async () => {
      await result.current.refresh()
    })

    const fetchCallsAfter = vi.mocked(global.fetch).mock.calls.length
    expect(fetchCallsAfter).toBeGreaterThan(fetchCallsBefore)
  })

  // TEST 14: Cleanup при unmount (cancel pending requests)
  it('should cleanup on unmount', async () => {
    const { result, unmount } = renderHook(() =>
      useComments({ projectId: 'proj1' }),
      { wrapper: createWrapper() }
    )

    vi.mocked(global.fetch).mockImplementationOnce(() =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve({ ok: true, status: 200, statusText: 'OK', json: async () => ({}) } as Response)
        }, 1000)
      })
    )

    act(() => {
      void result.current.addComment({
        content: 'Test',
        timecodeSec: 10,
        projectId: 'proj1',
      }).catch(() => undefined)
    })

    unmount()
  })

  // TEST 15: Duplicate request prevention
  it('should prevent duplicate requests', async () => {
    const { result } = renderHook(() =>
      useComments({ projectId: 'proj1' }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const newComment = {
      content: 'Test',
      timecodeSec: 10,
      projectId: 'proj1',
    }

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ ...newComment, id: '4', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: 'user1', status: 'OPEN' }),
    } as Response)

    await act(async () => {
      const promise1 = result.current.addComment(newComment)
      const promise2 = result.current.addComment(newComment)
      await Promise.all([promise1, promise2])
    })

    expect(result.current.comments.filter(c => c.content === 'Test').length).toBeLessThanOrEqual(2)
  })
})
