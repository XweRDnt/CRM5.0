import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
})

export const signupSchema = z.object({
  tenantName: z.string().min(2),
  ownerName: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
})

export const createClientSchema = z.object({
  companyName: z.string().min(2),
  contactName: z.string().min(2),
  email: z.email(),
  phone: z.string().optional(),
  notes: z.string().optional(),
})

export const createProjectSchema = z.object({
  clientAccountId: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional(),
  dueDate: z.string().optional(),
})

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const YOUTUBE_VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/

/**
 * Validates e-mail format using a practical RFC-like regex.
 */
export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim())
}

/**
 * Validates password strength and returns detailed errors.
 */
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain an uppercase letter')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain a number')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validates absolute URL with protocol (http/https).
 */
export function validateURL(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Validates timecode value for finite range [0, maxDuration].
 */
export function validateTimecode(timecode: number, maxDuration: number): boolean {
  if (!Number.isFinite(timecode) || !Number.isFinite(maxDuration)) {
    return false
  }

  if (timecode < 0 || maxDuration < 0) {
    return false
  }

  return timecode <= maxDuration
}

/**
 * Removes HTML tags from user-provided text.
 */
export function sanitizeInput(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

function extractYouTubeVideoId(url: URL): string | undefined {
  const host = url.hostname.replace(/^www\./, '')

  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0]
    return id
  }

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const fromQuery = url.searchParams.get('v')
    if (fromQuery) {
      return fromQuery
    }

    const parts = url.pathname.split('/').filter(Boolean)
    if (parts[0] === 'embed' || parts[0] === 'shorts') {
      return parts[1]
    }
  }

  return undefined
}

/**
 * Validates YouTube URL and extracts normalized video id when possible.
 */
export function validateYouTubeUrl(url: string): { valid: boolean; videoId?: string } {
  try {
    const parsed = new URL(url)
    const videoId = extractYouTubeVideoId(parsed)

    if (!videoId || !YOUTUBE_VIDEO_ID_REGEX.test(videoId)) {
      return { valid: false }
    }

    return { valid: true, videoId }
  } catch {
    return { valid: false }
  }
}
