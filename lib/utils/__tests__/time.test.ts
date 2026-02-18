import { describe, it, expect } from 'vitest'
import { formatTimecode, formatRelativeTime } from '../time'

describe('Time utilities', () => {
  describe('formatTimecode', () => {
    it('should format seconds to MM:SS', () => {
      expect(formatTimecode(0)).toBe('0:00')
      expect(formatTimecode(45)).toBe('0:45')
      expect(formatTimecode(90)).toBe('1:30')
      expect(formatTimecode(125)).toBe('2:05')
    })

    it('should format to HH:MM:SS for long videos', () => {
      expect(formatTimecode(3661)).toBe('1:01:01')
      expect(formatTimecode(7200)).toBe('2:00:00')
    })
  })

  describe('formatRelativeTime', () => {
    it('should format relative time', () => {
      const now = new Date()
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

      expect(formatRelativeTime(fiveMinutesAgo)).toContain('minute')
    })
  })
})