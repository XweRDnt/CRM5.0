'use client'

import { useEffect, useState } from 'react'

export interface WindowSize {
  width: number
  height: number
}

const RESIZE_DEBOUNCE_MS = 100

function getWindowSize(): WindowSize {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 }
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

/**
 * Tracks browser window size and updates with debounced resize listener.
 */
export function useWindowSize(): WindowSize {
  const [windowSize, setWindowSize] = useState<WindowSize>(() => getWindowSize())

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    let timer: ReturnType<typeof setTimeout> | undefined

    const onResize = (): void => {
      if (timer) {
        clearTimeout(timer)
      }

      timer = setTimeout(() => {
        setWindowSize(getWindowSize())
      }, RESIZE_DEBOUNCE_MS)
    }

    window.addEventListener('resize', onResize)

    return () => {
      if (timer) {
        clearTimeout(timer)
      }
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return windowSize
}