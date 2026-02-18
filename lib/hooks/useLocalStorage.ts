'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

function readLocalStorage<T>(key: string, initialValue: T): T {
  if (typeof window === 'undefined') {
    return initialValue
  }

  try {
    const item = window.localStorage.getItem(key)
    return item ? (JSON.parse(item) as T) : initialValue
  } catch {
    return initialValue
  }
}

/**
 * Persists state in localStorage with JSON serialization.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  const initialValueRef = useRef<T>(initialValue)
  const [storedValue, setStoredValue] = useState<T>(() =>
    readLocalStorage(key, initialValueRef.current)
  )

  useEffect(() => {
    initialValueRef.current = initialValue
  }, [initialValue])

  useEffect(() => {
    setStoredValue(readLocalStorage(key, initialValueRef.current))
  }, [key])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleStorage = (event: StorageEvent): void => {
      if (event.storageArea !== window.localStorage || event.key !== key) {
        return
      }

      if (event.newValue === null) {
        setStoredValue(initialValueRef.current)
        return
      }

      try {
        setStoredValue(JSON.parse(event.newValue) as T)
      } catch {
        setStoredValue(initialValueRef.current)
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [key])

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      setStoredValue((currentValue) => {
        const valueToStore = value instanceof Function ? value(currentValue) : value

        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(key, JSON.stringify(valueToStore))
          } catch {
            // localStorage may fail in private mode or when quota is exceeded.
          }
        }

        return valueToStore
      })
    },
    [key]
  )

  const removeValue = useCallback(() => {
    setStoredValue(initialValueRef.current)

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(key)
      } catch {
        // localStorage may fail in private mode or when quota is exceeded.
      }
    }
  }, [key])

  return [storedValue, setValue, removeValue]
}