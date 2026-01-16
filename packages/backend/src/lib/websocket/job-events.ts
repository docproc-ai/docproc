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
 * All connected WebSocket clients - broadcast to all for simplicity
 */
const allClients = new Set<WebSocket>()

/**
 * Register a new WebSocket client
 */
export function registerClient(ws: WebSocket) {
  allClients.add(ws)
}

/**
 * Subscribe a WebSocket client to job/batch events (legacy - now just registers)
 */
export function subscribeToJob(ws: WebSocket, _jobId: string) {
  registerClient(ws)
}

export function subscribeToBatch(ws: WebSocket, _batchId: string) {
  registerClient(ws)
}

/**
 * Unsubscribe/remove a WebSocket client
 */
export function unsubscribeAll(ws: WebSocket) {
  allClients.delete(ws)
}

/**
 * Broadcast an event to ALL connected clients
 */
export function broadcastJobEvent(event: JobEvent) {
  const message = JSON.stringify(event)

  for (const ws of allClients) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message)
      } else {
        // Clean up disconnected clients
        allClients.delete(ws)
      }
    } catch {
      // Remove failed client
      allClients.delete(ws)
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
