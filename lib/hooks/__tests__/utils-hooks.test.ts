/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMediaQuery } from '../useMediaQuery'
import { useWindowSize } from '../useWindowSize'
import { useDebounce } from '../useDebounce'
import { useLocalStorage } from '../useLocalStorage'

describe('Utils Hooks', () => {
  describe('useMediaQuery', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(min-width: 768px)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })
    })

    it('should return true for matching query', () => {
      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
      expect(result.current).toBe(true)
    })

    it('should return false for non-matching query', () => {
      const { result } = renderHook(() => useMediaQuery('(min-width: 2000px)'))
      expect(result.current).toBe(false)
    })
  })

  describe('useWindowSize', () => {
    it('should return current window size', () => {
      const { result } = renderHook(() => useWindowSize())

      expect(result.current.width).toBe(window.innerWidth)
      expect(result.current.height).toBe(window.innerHeight)
    })

    it('should update on resize', async () => {
      const { result } = renderHook(() => useWindowSize())

      act(() => {
        window.innerWidth = 1024
        window.innerHeight = 768
        window.dispatchEvent(new Event('resize'))
      })

      await waitFor(() => {
        expect(result.current.width).toBe(1024)
        expect(result.current.height).toBe(768)
      })
    })
  })

  describe('useDebounce', () => {
    it('should debounce value', () => {
      vi.useFakeTimers()
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      )

      expect(result.current).toBe('initial')
      rerender({ value: 'updated', delay: 500 })
      expect(result.current).toBe('initial')

      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(result.current).toBe('updated')
      vi.useRealTimers()
    })

    it('should cancel previous debounce on rapid changes', () => {
      vi.useFakeTimers()
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 500),
        { initialProps: { value: 'a' } }
      )

      rerender({ value: 'b' })
      act(() => vi.advanceTimersByTime(200))

      rerender({ value: 'c' })
      act(() => vi.advanceTimersByTime(200))

      rerender({ value: 'd' })
      act(() => vi.advanceTimersByTime(500))

      expect(result.current).toBe('d')
      vi.useRealTimers()
    })
  })

  describe('useLocalStorage', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('should return initial value', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'))
      expect(result.current[0]).toBe('initial')
    })

    it('should save value to localStorage', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'))

      act(() => {
        result.current[1]('updated')
      })

      expect(result.current[0]).toBe('updated')
      expect(localStorage.getItem('test-key')).toBe(JSON.stringify('updated'))
    })

    it('should load value from localStorage', () => {
      localStorage.setItem('test-key', JSON.stringify('stored'))

      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'))
      expect(result.current[0]).toBe('stored')
    })

    it('should remove value', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'))

      act(() => {
        result.current[1]('value')
      })

      expect(localStorage.getItem('test-key')).toBeTruthy()

      act(() => {
        result.current[2]()
      })

      expect(localStorage.getItem('test-key')).toBeNull()
    })

    it('should handle objects', () => {
      const { result } = renderHook(() => useLocalStorage('user', { name: 'John' }))

      act(() => {
        result.current[1]({ name: 'Jane' })
      })

      expect(result.current[0]).toEqual({ name: 'Jane' })
    })
  })
})
