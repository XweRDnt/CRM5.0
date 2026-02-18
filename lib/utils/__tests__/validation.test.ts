import { describe, it, expect } from 'vitest'
import {
  validateEmail,
  validatePassword,
  validateURL,
  validateTimecode,
  sanitizeInput,
  validateYouTubeUrl,
} from '../validation'

describe('validation', () => {
  describe('validateEmail', () => {
    it('should validate correct emails', () => {
      expect(validateEmail('test@example.com')).toBe(true)
      expect(validateEmail('user.name+tag@example.co.uk')).toBe(true)
    })

    it('should reject invalid emails', () => {
      expect(validateEmail('notanemail')).toBe(false)
      expect(validateEmail('missing@domain')).toBe(false)
      expect(validateEmail('@example.com')).toBe(false)
    })
  })

  describe('validatePassword', () => {
    it('should validate strong password', () => {
      const result = validatePassword('StrongPass123')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject weak passwords', () => {
      const result = validatePassword('weak')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must be at least 8 characters')
    })

    it('should require uppercase letter', () => {
      const result = validatePassword('lowercase123')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must contain an uppercase letter')
    })

    it('should require number', () => {
      const result = validatePassword('NoNumbers')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must contain a number')
    })
  })

  describe('validateURL', () => {
    it('should validate correct URLs', () => {
      expect(validateURL('https://example.com')).toBe(true)
      expect(validateURL('http://localhost:3000')).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect(validateURL('not a url')).toBe(false)
      expect(validateURL('example.com')).toBe(false)
    })
  })

  describe('validateTimecode', () => {
    it('should validate timecode within duration', () => {
      expect(validateTimecode(30, 120)).toBe(true)
      expect(validateTimecode(0, 120)).toBe(true)
      expect(validateTimecode(120, 120)).toBe(true)
    })

    it('should reject timecode beyond duration', () => {
      expect(validateTimecode(150, 120)).toBe(false)
      expect(validateTimecode(-5, 120)).toBe(false)
    })
  })

  describe('sanitizeInput', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('alert("xss")')
      expect(sanitizeInput('Hello <b>world</b>')).toBe('Hello world')
    })

    it('should keep safe text', () => {
      expect(sanitizeInput('Just plain text')).toBe('Just plain text')
    })
  })

  describe('validateYouTubeUrl', () => {
    it('should validate YouTube URLs and extract videoId', () => {
      const result = validateYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('dQw4w9WgXcQ')
    })

    it('should validate short YouTube URLs', () => {
      const result = validateYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('dQw4w9WgXcQ')
    })

    it('should reject invalid YouTube URLs', () => {
      const result = validateYouTubeUrl('https://example.com')
      expect(result.valid).toBe(false)
      expect(result.videoId).toBeUndefined()
    })
  })
})
