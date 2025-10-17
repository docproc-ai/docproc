'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { jsonrepair } from 'jsonrepair'

interface UseStreamingJsonOptions {
  api: string
  onUpdate?: (partialObject: any) => void
  onFinish?: (finalObject: any, error?: Error) => void
  onError?: (error: Error) => void
}

interface UseStreamingJsonReturn {
  object: any
  isLoading: boolean
  error: Error | null
  submit: (data: any) => void
  stop: () => void
}

/**
 * Custom hook for streaming JSON parsing that updates on every chunk
 * instead of waiting for complete top-level keys
 */
export function useStreamingJson({
  api,
  onUpdate,
  onFinish,
  onError,
}: UseStreamingJsonOptions): UseStreamingJsonReturn {
  const [object, setObject] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const accumulatedTextRef = useRef('')

  const parsePartialJson = useCallback((text: string): any => {
    const trimmed = text.trim()
    if (!trimmed) return null

    try {
      // First, try to parse as complete JSON
      return JSON.parse(trimmed)
    } catch {
      // If that fails, use jsonrepair to fix the malformed JSON
      try {
        const repairedJson = jsonrepair(trimmed)
        return JSON.parse(repairedJson)
      } catch {
        // If repair fails, just return null and try again on next chunk
        return null
      }
    }
  }, [])

  const submit = useCallback(
    async (data: any) => {
      setIsLoading(true)
      setError(null)
      setObject(null)
      accumulatedTextRef.current = ''

      // Create new abort controller
      abortControllerRef.current = new AbortController()

      try {
        const response = await fetch(api, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          // Handle rate limiting specifically
          if (response.status === 429) {
            const errorText = await response.text()
            throw new Error(`Rate limit exceeded: ${errorText}`)
          }
          
          // Handle other HTTP errors
          let errorMessage = `HTTP error! status: ${response.status}`
          try {
            const errorText = await response.text()
            if (errorText) {
              errorMessage = errorText
            }
          } catch {
            // If we can't read the error text, use the default message
          }
          
          throw new Error(errorMessage)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          // Decode the chunk
          const chunk = decoder.decode(value, { stream: true })
          accumulatedTextRef.current += chunk

          // Try to parse the accumulated text
          const partialObject = parsePartialJson(accumulatedTextRef.current)

          if (partialObject) {
            setObject(partialObject)
            onUpdate?.(partialObject)
          }
        }

        // Final parse attempt
        const finalText = accumulatedTextRef.current.trim()
        const finalObject = parsePartialJson(finalText)

        if (finalObject) {
          setObject(finalObject)
          onFinish?.(finalObject)
        } else if (finalText) {
          // Model returned text instead of JSON - treat as error with full message
          const error = new Error(finalText)
          setError(error)
          onError?.(error)
        }
      } catch (err) {
        // Don't log or set error state for intentional aborts
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        
        console.error('Streaming error:', err)
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        onError?.(error)
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [api, onUpdate, onFinish, onError, parsePartialJson],
  )

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    object,
    isLoading,
    error,
    submit,
    stop,
  }
}
