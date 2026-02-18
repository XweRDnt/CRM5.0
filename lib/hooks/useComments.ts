import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import useSWR from 'swr'

// Types
export interface Comment {
  id: string
  content: string
  timecodeSec: number
  category?: 'DESIGN' | 'AUDIO' | 'CONTENT' | 'TECHNICAL' | 'OTHER'
  priority?: 'HIGH' | 'MEDIUM' | 'LOW'
  status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'WONT_FIX'
  createdAt: string
  updatedAt: string
  userId: string
  projectId: string
  assetVersionId?: string
}

export interface CreateCommentInput {
  content: string
  timecodeSec: number
  category?: Comment['category']
  priority?: Comment['priority']
  projectId: string
  assetVersionId?: string
}

export interface UpdateCommentInput {
  content?: string
  timecodeSec?: number
  category?: Comment['category']
  priority?: Comment['priority']
  status?: Comment['status']
}

export interface UseCommentsOptions {
  projectId: string
  assetVersionId?: string
  /** Filter comments by timecode range */
  timecodeRange?: { start: number; end: number }
  /** Filter by category */
  category?: Comment['category']
  /** Filter by status */
  status?: Comment['status']
  /** Sort order */
  sortBy?: 'timecode' | 'createdAt' | 'priority'
  sortOrder?: 'asc' | 'desc'
  /** Enable auto-revalidation */
  revalidateOnFocus?: boolean
  revalidateOnReconnect?: boolean
}

export interface UseCommentsReturn {
  /** All comments (filtered and sorted) */
  comments: Comment[]
  /** Raw comments from API (before filtering) */
  rawComments: Comment[]
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: Error | null
  /** Is mutating (add/update/delete in progress) */
  isMutating: boolean

  // CRUD operations
  /** Add new comment (with optimistic update) */
  addComment: (input: CreateCommentInput) => Promise<Comment>
  /** Update existing comment (with optimistic update) */
  updateComment: (id: string, input: UpdateCommentInput) => Promise<Comment>
  /** Delete comment (with optimistic removal) */
  deleteComment: (id: string) => Promise<void>

  // Utilities
  /** Manually refresh comments from API */
  refresh: () => Promise<void>
  /** Get comment by ID */
  getCommentById: (id: string) => Comment | undefined
  /** Get comments at specific timecode (±1 second) */
  getCommentsAtTimecode: (timecode: number, tolerance?: number) => Comment[]
}

type ApiComment = Partial<Comment> & {
  text?: string
  author?: { id?: string }
  category?: string | null
  status?: string | null
}

const REQUEST_TIMEOUT_MS = 10_000
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 250

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return error
  }

  return new Error(fallback)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function isRequestCancelled(error: unknown): boolean {
  return isAbortError(error) || (error instanceof Error && error.message === 'Request cancelled')
}

function normalizeCategory(category: string | null | undefined): Comment['category'] {
  if (!category) {
    return undefined
  }

  if (category === 'SOUND') {
    return 'AUDIO'
  }

  if (category === 'LEGAL') {
    return 'OTHER'
  }

  if (category === 'DESIGN' || category === 'AUDIO' || category === 'CONTENT' || category === 'TECHNICAL' || category === 'OTHER') {
    return category
  }

  return undefined
}

function normalizeStatus(status: string | null | undefined): Comment['status'] {
  if (!status) {
    return undefined
  }

  if (status === 'NEW') {
    return 'OPEN'
  }

  if (status === 'REJECTED') {
    return 'WONT_FIX'
  }

  if (status === 'OPEN' || status === 'IN_PROGRESS' || status === 'RESOLVED' || status === 'WONT_FIX') {
    return status
  }

  return undefined
}

function toIsoDate(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return new Date().toISOString()
}

function normalizeComment(raw: ApiComment, projectId: string): Comment {
  return {
    id: raw.id ?? `temp-${Date.now()}`,
    content: raw.content ?? raw.text ?? '',
    timecodeSec: typeof raw.timecodeSec === 'number' ? raw.timecodeSec : 0,
    category: normalizeCategory(raw.category),
    priority: raw.priority,
    status: normalizeStatus(raw.status) ?? 'OPEN',
    createdAt: toIsoDate(raw.createdAt),
    updatedAt: toIsoDate(raw.updatedAt),
    userId: raw.userId ?? raw.author?.id ?? 'current-user',
    projectId: raw.projectId ?? projectId,
    assetVersionId: raw.assetVersionId,
  }
}

/**
 * Hook for managing video comments with CRUD operations
 *
 * Features:
 * - SWR-based caching and revalidation
 * - Optimistic updates for instant UI feedback
 * - Auto-retry on network errors
 * - Request cancellation on unmount
 */
export function useComments(options: UseCommentsOptions): UseCommentsReturn {
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const isMountedRef = useRef(true)
  const abortControllersRef = useRef<Set<AbortController>>(new Set())
  const inflightMutationsRef = useRef<Map<string, Promise<unknown>>>(new Map())
  const mutationCountRef = useRef(0)

  const setMutatingState = useCallback((delta: number): void => {
    mutationCountRef.current = Math.max(0, mutationCountRef.current + delta)
    setIsMutating(mutationCountRef.current > 0)
  }, [])

  const createTrackedController = useCallback((): AbortController => {
    const controller = new AbortController()
    abortControllersRef.current.add(controller)
    return controller
  }, [])

  const releaseTrackedController = useCallback((controller: AbortController): void => {
    abortControllersRef.current.delete(controller)
  }, [])

  const requestJSON = useCallback(async <T,>(url: string, init?: RequestInit, retries: number = MAX_RETRIES): Promise<T> => {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      const controller = createTrackedController()
      const timeoutId = setTimeout(() => {
        controller.abort()
      }, REQUEST_TIMEOUT_MS)

      try {
        const normalizedHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
        if (init?.headers) {
          const extraHeaders = new Headers(init.headers)
          extraHeaders.forEach((value, key) => {
            normalizedHeaders[key] = value
          })
        }

        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
          headers: normalizedHeaders,
        })

        if (!response.ok) {
          if (response.status === 409) {
            throw new Error('Conflict: comment was changed by another user. Please refresh and try again.')
          }

          throw new Error(`Request failed (${response.status} ${response.statusText})`)
        }

        return (await response.json()) as T
      } catch (requestError) {
        const normalized = toError(requestError, 'Request failed')

        if (isAbortError(requestError) && !isMountedRef.current) {
          throw new Error('Request cancelled')
        }

        lastError = normalized

        if (attempt < retries) {
          await delay(RETRY_DELAY_MS * attempt)
          continue
        }
      } finally {
        clearTimeout(timeoutId)
        releaseTrackedController(controller)
      }
    }

    throw lastError ?? new Error('Request failed')
  }, [createTrackedController, releaseTrackedController])

  const fetcher = useCallback(async (url: string): Promise<Comment[]> => {
    const raw = await requestJSON<ApiComment[]>(url, undefined, 1)
    return raw.map((item) => normalizeComment(item, options.projectId))
  }, [options.projectId, requestJSON])

  const { data, error: swrError, isLoading, mutate: mutateSWR } = useSWR<Comment[]>(
    `/api/projects/${options.projectId}/feedback`,
    fetcher,
    {
      revalidateOnFocus: options.revalidateOnFocus ?? true,
      revalidateOnReconnect: options.revalidateOnReconnect ?? true,
      shouldRetryOnError: true,
      errorRetryCount: MAX_RETRIES,
    }
  )

  const runDedupedMutation = useCallback(async <T,>(key: string, mutation: () => Promise<T>): Promise<T> => {
    const existing = inflightMutationsRef.current.get(key)
    if (existing) {
      return existing as Promise<T>
    }

    setMutatingState(1)

    const nextMutation = mutation()
      .finally(() => {
        inflightMutationsRef.current.delete(key)
        setMutatingState(-1)
      })

    inflightMutationsRef.current.set(key, nextMutation)
    return nextMutation
  }, [setMutatingState])

  const processComments = useCallback((comments: Comment[]): Comment[] => {
    let filtered = [...comments]

    if (options.assetVersionId) {
      filtered = filtered.filter((comment) => comment.assetVersionId === options.assetVersionId)
    }

    if (options.category) {
      filtered = filtered.filter((comment) => comment.category === options.category)
    }

    if (options.status) {
      filtered = filtered.filter((comment) => comment.status === options.status)
    }

    if (options.timecodeRange) {
      const { start, end } = options.timecodeRange
      filtered = filtered.filter((comment) => comment.timecodeSec >= start && comment.timecodeSec <= end)
    }

    const sortBy = options.sortBy
    const sortOrder = options.sortOrder ?? 'asc'

    const priorityOrder: Record<NonNullable<Comment['priority']>, number> = {
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    }

    if (sortBy) {
      filtered.sort((a, b) => {
        let comparison = 0

        if (sortBy === 'timecode') {
          comparison = a.timecodeSec - b.timecodeSec
        } else if (sortBy === 'createdAt') {
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        } else {
          comparison = priorityOrder[a.priority ?? 'LOW'] - priorityOrder[b.priority ?? 'LOW']
        }

        return sortOrder === 'asc' ? comparison : -comparison
      })
    }

    return filtered
  }, [options.assetVersionId, options.category, options.sortBy, options.sortOrder, options.status, options.timecodeRange])

  const addComment = useCallback(async (input: CreateCommentInput): Promise<Comment> => {
    if (!input.content.trim()) {
      const validationError = new Error('Comment content is required')
      setError(validationError)
      throw validationError
    }

    if (!Number.isFinite(input.timecodeSec) || input.timecodeSec < 0) {
      const validationError = new Error('Valid timecodeSec is required')
      setError(validationError)
      throw validationError
    }

    const key = `add:${JSON.stringify(input)}`

    return runDedupedMutation(key, async () => {
      setError(null)

      const tempComment: Comment = {
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        content: input.content,
        timecodeSec: input.timecodeSec,
        category: input.category,
        priority: input.priority,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: 'current-user',
        projectId: input.projectId,
        assetVersionId: input.assetVersionId,
      }

      await mutateSWR((current = []) => [...current, tempComment], false)

      try {
        const createdRaw = await requestJSON<ApiComment>('/api/feedback', {
          method: 'POST',
          body: JSON.stringify(input),
        })

        const createdComment = normalizeComment(createdRaw, options.projectId)

        await mutateSWR(
          (current = []) => current.map((comment) => (comment.id === tempComment.id ? createdComment : comment)),
          false,
        )

        return createdComment
      } catch (mutationError) {
        if (!isMountedRef.current && isRequestCancelled(mutationError)) {
          return tempComment
        }

        await mutateSWR((current = []) => current.filter((comment) => comment.id !== tempComment.id), false)
        await mutateSWR()

        const normalizedError = toError(mutationError, 'Failed to add comment')
        setError(normalizedError)
        throw normalizedError
      }
    })
  }, [mutateSWR, options.projectId, requestJSON, runDedupedMutation])

  const updateComment = useCallback(async (
    id: string,
    input: UpdateCommentInput
  ): Promise<Comment> => {
    const key = `update:${id}:${JSON.stringify(input)}`

    return runDedupedMutation(key, async () => {
      setError(null)

      const currentComments = data ?? []
      const existing = currentComments.find((comment) => comment.id === id)
      if (!existing) {
        const missingError = new Error('Comment not found')
        setError(missingError)
        throw missingError
      }

      const optimisticUpdated: Comment = {
        ...existing,
        ...input,
        updatedAt: new Date().toISOString(),
      }

      await mutateSWR(
        (current = []) => current.map((comment) => (comment.id === id ? optimisticUpdated : comment)),
        false,
      )

      try {
        const updatedRaw = await requestJSON<ApiComment>(`/api/feedback/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(input),
        })

        const updatedComment = normalizeComment({ ...existing, ...updatedRaw }, options.projectId)

        await mutateSWR(
          (current = []) => current.map((comment) => (comment.id === id ? updatedComment : comment)),
          false,
        )

        return updatedComment
      } catch (mutationError) {
        if (!isMountedRef.current && isRequestCancelled(mutationError)) {
          return optimisticUpdated
        }

        await mutateSWR(
          (current = []) => current.map((comment) => (comment.id === id ? existing : comment)),
          false,
        )
        await mutateSWR()

        const normalizedError = toError(mutationError, 'Failed to update comment')
        setError(normalizedError)
        throw normalizedError
      }
    })
  }, [data, mutateSWR, options.projectId, requestJSON, runDedupedMutation])

  const deleteComment = useCallback(async (id: string): Promise<void> => {
    const key = `delete:${id}`

    return runDedupedMutation(key, async () => {
      setError(null)

      const currentComments = data ?? []
      const existing = currentComments.find((comment) => comment.id === id)
      if (!existing) {
        return
      }

      await mutateSWR((current = []) => current.filter((comment) => comment.id !== id), false)

      try {
        await requestJSON<{ success?: boolean }>(`/api/feedback/${id}`, {
          method: 'DELETE',
        })
      } catch (mutationError) {
        if (!isMountedRef.current && isRequestCancelled(mutationError)) {
          return
        }

        await mutateSWR((current = []) => [...current, existing], false)
        await mutateSWR()

        const normalizedError = toError(mutationError, 'Failed to delete comment')
        setError(normalizedError)
        throw normalizedError
      }
    })
  }, [data, mutateSWR, requestJSON, runDedupedMutation])

  const refresh = useCallback(async (): Promise<void> => {
    setError(null)

    try {
      await mutateSWR()
    } catch (refreshError) {
      const normalizedError = toError(refreshError, 'Failed to refresh comments')
      setError(normalizedError)
      throw normalizedError
    }
  }, [mutateSWR])

  const getCommentById = useCallback((id: string): Comment | undefined => {
    return (data ?? []).find((comment) => comment.id === id)
  }, [data])

  const getCommentsAtTimecode = useCallback((
    timecode: number,
    tolerance: number = 1
  ): Comment[] => {
    return (data ?? []).filter((comment) => Math.abs(comment.timecodeSec - timecode) <= tolerance)
  }, [data])

  useEffect(() => {
    isMountedRef.current = true
    const controllers = abortControllersRef.current

    return () => {
      isMountedRef.current = false
      controllers.forEach((controller) => {
        controller.abort()
      })
      controllers.clear()
    }
  }, [])

  const processedComments = useMemo(() => {
    return processComments(data ?? [])
  }, [data, processComments])

  return {
    comments: processedComments,
    rawComments: data ?? [],
    isLoading,
    error: error ?? (swrError instanceof Error ? swrError : null),
    isMutating,
    addComment,
    updateComment,
    deleteComment,
    refresh,
    getCommentById,
    getCommentsAtTimecode,
  }
}
