/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fadeIn, fadeOut, smoothScroll } from '../animations'

describe('animations', () => {
  let element: HTMLElement

  beforeEach(() => {
    vi.useFakeTimers()
    element = document.createElement('div')
    document.body.appendChild(element)
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  describe('fadeIn', () => {
    it('should fade in element', () => {
      element.style.opacity = '0'

      expect(() => fadeIn(element, { duration: 100 })).not.toThrow()
      vi.advanceTimersByTime(120)

      expect(element.style.opacity).toBe('1')
    })

    it('should call onComplete callback', () => {
      const onComplete = vi.fn()

      fadeIn(element, {
        duration: 100,
        onComplete,
      })

      vi.advanceTimersByTime(100)
      expect(onComplete).toHaveBeenCalledTimes(1)
    })
  })

  describe('fadeOut', () => {
    it('should fade out element', () => {
      element.style.opacity = '1'

      expect(() => fadeOut(element, { duration: 100 })).not.toThrow()
      vi.advanceTimersByTime(120)

      expect(element.style.opacity).toBe('0')
    })
  })

  describe('smoothScroll', () => {
    it('should scroll to element by selector', () => {
      const target = document.createElement('div')
      target.id = 'target'
      document.body.appendChild(target)

      const scrollIntoView = vi.fn()
      target.scrollIntoView = scrollIntoView

      expect(() => smoothScroll('#target')).not.toThrow()
      expect(scrollIntoView).toHaveBeenCalled()
    })

    it('should scroll with offset', () => {
      const target = document.createElement('div')
      document.body.appendChild(target)
      const scrollTo = vi.fn()
      vi.stubGlobal('scrollTo', scrollTo)

      target.getBoundingClientRect = vi.fn(() => ({
        x: 0,
        y: 200,
        width: 0,
        height: 0,
        top: 200,
        right: 0,
        bottom: 200,
        left: 0,
        toJSON: () => ({}),
      }))

      expect(() => smoothScroll(target, { offset: -80 })).not.toThrow()
      expect(scrollTo).toHaveBeenCalled()
    })
  })
})
