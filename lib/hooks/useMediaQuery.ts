'use client'

import { useEffect, useState } from 'react'

function getMatches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia(query).matches
}

/**
 * Reactively tracks whether a media query currently matches.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => getMatches(query))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQueryList = window.matchMedia(query)
    setMatches(mediaQueryList.matches)

    const handleChange = (event: MediaQueryListEvent): void => {
      setMatches(event.matches)
    }

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handleChange)
      return () => mediaQueryList.removeEventListener('change', handleChange)
    }

    mediaQueryList.addListener(handleChange)
    return () => mediaQueryList.removeListener(handleChange)
  }, [query])

  return matches
}

export const breakpoints = {
  sm: '(min-width: 640px)',
  md: '(min-width: 768px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1280px)',
}