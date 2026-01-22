import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

// Event types from backend
export type JobEventType =
  | 'job:started'
  | 'job:progress'
  | 'job:completed'
  | 'job:failed'
  | 'batch:started'
  | 'batch:progress'
  | 'batch:completed'
  | 'batch:failed'

export interface JobEvent {
  type: JobEventType
  jobId?: string
  batchId?: string
  documentId?: string
  documentTypeId?: string
  data: {
    status?: string
    progress?: number
    partialData?: unknown
    error?: string
    completed?: number
    failed?: number
    total?: number
  }
  timestamp: string
}

interface WebSocketMessage {
  type: string
  id?: string
  jobId?: string
  batchId?: string
  documentId?: string
  data?: unknown
  timestamp?: string
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

// Global WebSocket instance (singleton)
let globalWs: WebSocket | null = null
let globalConnectionId: string | null = null
const listeners = new Set<(event: JobEvent) => void>()
const statusListeners = new Set<(status: ConnectionStatus) => void>()

function notifyStatusChange(status: ConnectionStatus) {
  statusListeners.forEach((listener) => listener(status))
}

function getWebSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  // In dev, backend is on port 3001
  const host = import.meta.env.DEV ? 'localhost:3001' : window.location.host
  return `${protocol}//${host}/ws`
}

function connect() {
  // Guard against both OPEN and CONNECTING states to prevent duplicate connections
  if (
    globalWs?.readyState === WebSocket.OPEN ||
    globalWs?.readyState === WebSocket.CONNECTING
  ) {
    return
  }

  notifyStatusChange('connecting')
  const ws = new WebSocket(getWebSocketUrl())

  ws.onopen = () => {
    console.log('[WS] Connected')
    notifyStatusChange('connected')
  }

  ws.onmessage = (event) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data)

      // Handle connection confirmation
      if (message.type === 'connected') {
        globalConnectionId = message.id || null
        console.log('[WS] Connection ID:', globalConnectionId)
        return
      }

      // Handle pong
      if (message.type === 'pong') {
        return
      }

      // Handle job/batch events
      if (
        message.type?.startsWith('job:') ||
        message.type?.startsWith('batch:')
      ) {
        const jobEvent = message as unknown as JobEvent
        listeners.forEach((listener) => listener(jobEvent))
      }
    } catch (err) {
      console.error('[WS] Failed to parse message:', err)
    }
  }

  ws.onerror = (error) => {
    console.error('[WS] Error:', error)
    notifyStatusChange('error')
  }

  ws.onclose = () => {
    console.log('[WS] Disconnected')
    notifyStatusChange('disconnected')
    globalWs = null
    globalConnectionId = null

    // Auto-reconnect after 3 seconds
    setTimeout(() => {
      if (listeners.size > 0) {
        connect()
      }
    }, 3000)
  }

  globalWs = ws
}

function disconnect() {
  if (globalWs) {
    globalWs.close()
    globalWs = null
    globalConnectionId = null
  }
}

function subscribe(jobId?: string, batchId?: string, documentTypeId?: string) {
  if (!globalWs || globalWs.readyState !== WebSocket.OPEN) return

  const message: {
    type: string
    jobId?: string
    batchId?: string
    documentTypeId?: string
  } = {
    type: 'subscribe',
  }
  if (jobId) message.jobId = jobId
  if (batchId) message.batchId = batchId
  if (documentTypeId) message.documentTypeId = documentTypeId

  globalWs.send(JSON.stringify(message))
  console.log('[WS] Subscribed to:', { jobId, batchId, documentTypeId })
}

function unsubscribe(
  jobId?: string,
  batchId?: string,
  documentTypeId?: string,
) {
  if (!globalWs || globalWs.readyState !== WebSocket.OPEN) return

  const message: {
    type: string
    jobId?: string
    batchId?: string
    documentTypeId?: string
  } = {
    type: 'unsubscribe',
  }
  if (jobId) message.jobId = jobId
  if (batchId) message.batchId = batchId
  if (documentTypeId) message.documentTypeId = documentTypeId

  globalWs.send(JSON.stringify(message))
  console.log('[WS] Unsubscribed from:', { jobId, batchId, documentTypeId })
}

// Hook for WebSocket connection status
export function useWebSocketStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(
    globalWs?.readyState === WebSocket.OPEN ? 'connected' : 'disconnected',
  )

  useEffect(() => {
    statusListeners.add(setStatus)
    return () => {
      statusListeners.delete(setStatus)
    }
  }, [])

  return status
}

// Hook for subscribing to job events
export function useJobEvents(
  onEvent: (event: JobEvent) => void,
  deps: React.DependencyList = [],
) {
  const callbackRef = useRef(onEvent)
  callbackRef.current = onEvent

  useEffect(() => {
    const handler = (event: JobEvent) => callbackRef.current(event)
    listeners.add(handler)

    // Connect if not already connected
    if (!globalWs || globalWs.readyState !== WebSocket.OPEN) {
      connect()
    }

    return () => {
      listeners.delete(handler)
      // Disconnect if no more listeners
      if (listeners.size === 0) {
        disconnect()
      }
    }
  }, deps)
}

// Hook for document type live updates
export function useDocumentTypeLiveUpdates(documentTypeId: string | undefined) {
  const queryClient = useQueryClient()

  useJobEvents(
    useCallback(
      (event: JobEvent) => {
        console.log('[WS] Event received:', event)

        // Update document in cache when job completes or progresses
        if (event.documentId) {
          if (event.type === 'job:completed') {
            // Optimistically update document status in list cache
            queryClient.setQueriesData(
              { queryKey: ['documents'], exact: false },
              (old: unknown) => {
                if (!old || typeof old !== 'object' || !('documents' in old))
                  return old
                const data = old as {
                  documents: Array<{ id: string; status: string | null }>
                }
                return {
                  ...data,
                  documents: data.documents.map((doc) =>
                    doc.id === event.documentId
                      ? { ...doc, status: 'processed' }
                      : doc,
                  ),
                }
              },
            )
            // Force refetch individual document for fresh extracted data
            queryClient.refetchQueries({
              queryKey: ['document', event.documentId],
            })
            // Invalidate active jobs
            queryClient.invalidateQueries({
              queryKey: ['activeJobs'],
              exact: false,
            })
          } else if (event.type === 'job:progress' && event.data.partialData) {
            // Optimistically update with partial data
            queryClient.setQueryData(
              ['document', event.documentId],
              (old: unknown) => {
                if (!old || typeof old !== 'object') return old
                return {
                  ...old,
                  extractedData: event.data.partialData,
                  status: 'processing',
                }
              },
            )
          } else if (event.type === 'job:failed') {
            // Optimistically update document status in list cache
            queryClient.setQueriesData(
              { queryKey: ['documents'], exact: false },
              (old: unknown) => {
                if (!old || typeof old !== 'object' || !('documents' in old))
                  return old
                const data = old as {
                  documents: Array<{ id: string; status: string | null }>
                }
                return {
                  ...data,
                  documents: data.documents.map((doc) =>
                    doc.id === event.documentId
                      ? { ...doc, status: 'pending' }
                      : doc,
                  ),
                }
              },
            )
            // Force refetch individual document
            queryClient.refetchQueries({
              queryKey: ['document', event.documentId],
            })
            // Invalidate active jobs
            queryClient.invalidateQueries({
              queryKey: ['activeJobs'],
              exact: false,
            })
          } else if (event.type === 'job:started') {
            // Optimistically mark document as processing in individual cache
            queryClient.setQueryData(
              ['document', event.documentId],
              (old: unknown) => {
                if (!old || typeof old !== 'object') return old
                return {
                  ...old,
                  status: 'processing',
                }
              },
            )
            // Also update documents list cache to show processing status
            queryClient.setQueriesData(
              { queryKey: ['documents'], exact: false },
              (old: unknown) => {
                if (!old || typeof old !== 'object' || !('documents' in old))
                  return old
                const data = old as {
                  documents: Array<{ id: string; status: string | null }>
                }
                return {
                  ...data,
                  documents: data.documents.map((doc) =>
                    doc.id === event.documentId
                      ? { ...doc, status: 'processing' }
                      : doc,
                  ),
                }
              },
            )
          }
        }

        // Handle batch events - refetch to ensure final state is accurate
        if (event.type === 'batch:completed' || event.type === 'batch:failed') {
          queryClient.refetchQueries({
            queryKey: ['documents'],
            exact: false,
          })
          queryClient.invalidateQueries({
            queryKey: ['activeJobs'],
            exact: false,
          })
        }
      },
      [queryClient],
    ),
    [documentTypeId],
  )

  // Subscribe to document type updates when connected
  const status = useWebSocketStatus()

  useEffect(() => {
    if (status === 'connected' && documentTypeId) {
      subscribe(undefined, undefined, documentTypeId)
      return () => unsubscribe(undefined, undefined, documentTypeId)
    }
  }, [status, documentTypeId])

  return { status }
}

// Hook for subscribing to a specific job
export function useJobSubscription(jobId: string | undefined) {
  const queryClient = useQueryClient()
  const status = useWebSocketStatus()

  useEffect(() => {
    if (status === 'connected' && jobId) {
      subscribe(jobId)
      return () => unsubscribe(jobId)
    }
  }, [status, jobId])

  useJobEvents(
    useCallback(
      (event: JobEvent) => {
        if (event.jobId !== jobId) return

        if (event.documentId) {
          if (event.type === 'job:completed') {
            // Optimistically update document status in list cache
            queryClient.setQueriesData(
              { queryKey: ['documents'], exact: false },
              (old: unknown) => {
                if (!old || typeof old !== 'object' || !('documents' in old))
                  return old
                const data = old as {
                  documents: Array<{ id: string; status: string | null }>
                }
                return {
                  ...data,
                  documents: data.documents.map((doc) =>
                    doc.id === event.documentId
                      ? { ...doc, status: 'processed' }
                      : doc,
                  ),
                }
              },
            )
            // Force refetch individual document
            queryClient.refetchQueries({
              queryKey: ['document', event.documentId],
            })
            queryClient.invalidateQueries({
              queryKey: ['activeJobs'],
              exact: false,
            })
          } else if (event.type === 'job:failed') {
            // Optimistically update document status in list cache
            queryClient.setQueriesData(
              { queryKey: ['documents'], exact: false },
              (old: unknown) => {
                if (!old || typeof old !== 'object' || !('documents' in old))
                  return old
                const data = old as {
                  documents: Array<{ id: string; status: string | null }>
                }
                return {
                  ...data,
                  documents: data.documents.map((doc) =>
                    doc.id === event.documentId
                      ? { ...doc, status: 'pending' }
                      : doc,
                  ),
                }
              },
            )
            // Force refetch individual document
            queryClient.refetchQueries({
              queryKey: ['document', event.documentId],
            })
            queryClient.invalidateQueries({
              queryKey: ['activeJobs'],
              exact: false,
            })
          }
        }
      },
      [jobId, queryClient],
    ),
    [jobId],
  )

  return { status }
}

// Hook for subscribing to a batch
export function useBatchSubscription(batchId: string | undefined) {
  const queryClient = useQueryClient()
  const status = useWebSocketStatus()
  const [progress, setProgress] = useState<{
    completed: number
    failed: number
    total: number
  } | null>(null)

  useEffect(() => {
    if (status === 'connected' && batchId) {
      subscribe(undefined, batchId)
      return () => unsubscribe(undefined, batchId)
    }
  }, [status, batchId])

  useJobEvents(
    useCallback(
      (event: JobEvent) => {
        if (event.batchId !== batchId) return

        if (
          event.type === 'batch:progress' ||
          event.type === 'batch:completed'
        ) {
          setProgress({
            completed: event.data.completed || 0,
            failed: event.data.failed || 0,
            total: event.data.total || 0,
          })
        }

        if (event.type === 'batch:completed' || event.type === 'batch:failed') {
          queryClient.refetchQueries({
            queryKey: ['documents'],
            exact: false,
          })
          queryClient.invalidateQueries({
            queryKey: ['activeJobs'],
            exact: false,
          })
        }

        // Also handle individual job completions within batch
        if (event.documentId && event.type === 'job:completed') {
          // Optimistically update document status in list cache
          queryClient.setQueriesData(
            { queryKey: ['documents'], exact: false },
            (old: unknown) => {
              if (!old || typeof old !== 'object' || !('documents' in old))
                return old
              const data = old as {
                documents: Array<{ id: string; status: string | null }>
              }
              return {
                ...data,
                documents: data.documents.map((doc) =>
                  doc.id === event.documentId
                    ? { ...doc, status: 'processed' }
                    : doc,
                ),
              }
            },
          )
          // Force refetch individual document for fresh extracted data
          queryClient.refetchQueries({
            queryKey: ['document', event.documentId],
          })
          queryClient.invalidateQueries({
            queryKey: ['activeJobs'],
            exact: false,
          })
        } else if (event.documentId && event.type === 'job:failed') {
          // Optimistically update document status in list cache
          queryClient.setQueriesData(
            { queryKey: ['documents'], exact: false },
            (old: unknown) => {
              if (!old || typeof old !== 'object' || !('documents' in old))
                return old
              const data = old as {
                documents: Array<{ id: string; status: string | null }>
              }
              return {
                ...data,
                documents: data.documents.map((doc) =>
                  doc.id === event.documentId
                    ? { ...doc, status: 'pending' }
                    : doc,
                ),
              }
            },
          )
          // Force refetch individual document
          queryClient.refetchQueries({
            queryKey: ['document', event.documentId],
          })
          queryClient.invalidateQueries({
            queryKey: ['activeJobs'],
            exact: false,
          })
        }
      },
      [batchId, queryClient],
    ),
    [batchId],
  )

  return { status, progress }
}

// Export for manual control
export const websocket = {
  connect,
  disconnect,
  subscribe,
  unsubscribe,
}
