/**
 * WebSocket event types for job progress
 */

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

/**
 * WebSocket client connections mapped by subscription
 */
const subscriptions = new Map<string, Set<WebSocket>>()

/**
 * Subscribe a WebSocket client to job/batch events
 */
export function subscribeToJob(ws: WebSocket, jobId: string) {
  const key = `job:${jobId}`
  if (!subscriptions.has(key)) {
    subscriptions.set(key, new Set())
  }
  subscriptions.get(key)!.add(ws)
}

export function subscribeToBatch(ws: WebSocket, batchId: string) {
  const key = `batch:${batchId}`
  if (!subscriptions.has(key)) {
    subscriptions.set(key, new Set())
  }
  subscriptions.get(key)!.add(ws)
}

/**
 * Unsubscribe a WebSocket client from all events
 */
export function unsubscribeAll(ws: WebSocket) {
  for (const clients of subscriptions.values()) {
    clients.delete(ws)
  }
}

/**
 * Broadcast an event to all subscribed clients
 */
export function broadcastJobEvent(event: JobEvent) {
  const keys: string[] = []

  if (event.jobId) {
    keys.push(`job:${event.jobId}`)
  }
  if (event.batchId) {
    keys.push(`batch:${event.batchId}`)
  }

  const message = JSON.stringify(event)

  for (const key of keys) {
    const clients = subscriptions.get(key)
    if (clients) {
      for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message)
        }
      }
    }
  }
}

// Convenience functions for emitting common events
export function emitJobStarted(jobId: string, documentId: string, batchId?: string) {
  broadcastJobEvent({
    type: 'job:started',
    jobId,
    documentId,
    batchId,
    data: { status: 'processing' },
    timestamp: new Date().toISOString(),
  })
}

export function emitJobProgress(
  jobId: string,
  documentId: string,
  progress: number,
  partialData?: unknown,
  batchId?: string,
) {
  broadcastJobEvent({
    type: 'job:progress',
    jobId,
    documentId,
    batchId,
    data: { progress, partialData },
    timestamp: new Date().toISOString(),
  })
}

export function emitJobCompleted(jobId: string, documentId: string, batchId?: string) {
  broadcastJobEvent({
    type: 'job:completed',
    jobId,
    documentId,
    batchId,
    data: { status: 'completed', progress: 100 },
    timestamp: new Date().toISOString(),
  })
}

export function emitJobFailed(jobId: string, documentId: string, error: string, batchId?: string) {
  broadcastJobEvent({
    type: 'job:failed',
    jobId,
    documentId,
    batchId,
    data: { status: 'failed', error },
    timestamp: new Date().toISOString(),
  })
}

export function emitBatchStarted(batchId: string, total: number) {
  broadcastJobEvent({
    type: 'batch:started',
    batchId,
    data: { status: 'processing', total, completed: 0, failed: 0 },
    timestamp: new Date().toISOString(),
  })
}

export function emitBatchProgress(batchId: string, completed: number, failed: number, total: number) {
  broadcastJobEvent({
    type: 'batch:progress',
    batchId,
    data: { completed, failed, total },
    timestamp: new Date().toISOString(),
  })
}

export function emitBatchCompleted(batchId: string, completed: number, failed: number, total: number) {
  broadcastJobEvent({
    type: 'batch:completed',
    batchId,
    data: { status: 'completed', completed, failed, total },
    timestamp: new Date().toISOString(),
  })
}

export function emitBatchFailed(batchId: string, error: string) {
  broadcastJobEvent({
    type: 'batch:failed',
    batchId,
    data: { status: 'failed', error },
    timestamp: new Date().toISOString(),
  })
}
