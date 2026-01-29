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

/**
 * WebSocket clients subscribed by document type
 * Key: documentTypeId, Value: Set of WebSocket clients
 */
const documentTypeSubscriptions = new Map<string, Set<WebSocket>>()

/**
 * All connected clients (for cleanup tracking)
 */
const allClients = new Set<WebSocket>()

/**
 * Register a new WebSocket client
 */
export function registerClient(ws: WebSocket) {
  allClients.add(ws)
}

/**
 * Subscribe a WebSocket client to a document type's events
 */
export function subscribeToDocumentType(ws: WebSocket, documentTypeId: string) {
  registerClient(ws)
  if (!documentTypeSubscriptions.has(documentTypeId)) {
    documentTypeSubscriptions.set(documentTypeId, new Set())
  }
  documentTypeSubscriptions.get(documentTypeId)?.add(ws)
}

/**
 * Unsubscribe from a document type
 */
export function unsubscribeFromDocumentType(
  ws: WebSocket,
  documentTypeId: string,
) {
  const clients = documentTypeSubscriptions.get(documentTypeId)
  if (clients) {
    clients.delete(ws)
    if (clients.size === 0) {
      documentTypeSubscriptions.delete(documentTypeId)
    }
  }
}

/**
 * Legacy subscription functions - redirect to document type subscription
 */
export function subscribeToJob(ws: WebSocket, _jobId: string) {
  registerClient(ws)
}

export function subscribeToBatch(ws: WebSocket, _batchId: string) {
  registerClient(ws)
}

/**
 * Unsubscribe/remove a WebSocket client from all subscriptions
 */
export function unsubscribeAll(ws: WebSocket) {
  allClients.delete(ws)
  // Remove from all document type subscriptions
  for (const clients of documentTypeSubscriptions.values()) {
    clients.delete(ws)
  }
}

/**
 * Broadcast an event to clients subscribed to the relevant document type
 */
export function broadcastJobEvent(event: JobEvent) {
  const message = JSON.stringify(event)

  // If event has a documentTypeId, only send to subscribed clients
  if (event.documentTypeId) {
    const clients = documentTypeSubscriptions.get(event.documentTypeId)
    if (clients) {
      for (const ws of clients) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(message)
          } else {
            clients.delete(ws)
            allClients.delete(ws)
          }
        } catch {
          clients.delete(ws)
          allClients.delete(ws)
        }
      }
    }
  } else {
    // Fallback: broadcast to all (shouldn't happen with proper event emission)
    for (const ws of allClients) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message)
        } else {
          allClients.delete(ws)
        }
      } catch {
        allClients.delete(ws)
      }
    }
  }
}

// Convenience functions for emitting common events
// All events include documentTypeId for scoped broadcasting

export function emitJobStarted(
  jobId: string,
  documentId: string,
  documentTypeId: string,
  batchId?: string,
) {
  broadcastJobEvent({
    type: 'job:started',
    jobId,
    documentId,
    documentTypeId,
    batchId,
    data: { status: 'processing' },
    timestamp: new Date().toISOString(),
  })
}

export function emitJobProgress(
  jobId: string,
  documentId: string,
  documentTypeId: string,
  progress: number,
  partialData?: unknown,
  batchId?: string,
) {
  broadcastJobEvent({
    type: 'job:progress',
    jobId,
    documentId,
    documentTypeId,
    batchId,
    data: { progress, partialData },
    timestamp: new Date().toISOString(),
  })
}

export function emitJobCompleted(
  jobId: string,
  documentId: string,
  documentTypeId: string,
  batchId?: string,
) {
  broadcastJobEvent({
    type: 'job:completed',
    jobId,
    documentId,
    documentTypeId,
    batchId,
    data: { status: 'completed', progress: 100 },
    timestamp: new Date().toISOString(),
  })
}

export function emitJobFailed(
  jobId: string,
  documentId: string,
  documentTypeId: string,
  error: string,
  batchId?: string,
) {
  broadcastJobEvent({
    type: 'job:failed',
    jobId,
    documentId,
    documentTypeId,
    batchId,
    data: { status: 'failed', error },
    timestamp: new Date().toISOString(),
  })
}

export function emitBatchStarted(
  batchId: string,
  documentTypeId: string,
  total: number,
) {
  broadcastJobEvent({
    type: 'batch:started',
    batchId,
    documentTypeId,
    data: { status: 'processing', total, completed: 0, failed: 0 },
    timestamp: new Date().toISOString(),
  })
}

export function emitBatchProgress(
  batchId: string,
  documentTypeId: string,
  completed: number,
  failed: number,
  total: number,
) {
  broadcastJobEvent({
    type: 'batch:progress',
    batchId,
    documentTypeId,
    data: { completed, failed, total },
    timestamp: new Date().toISOString(),
  })
}

export function emitBatchCompleted(
  batchId: string,
  documentTypeId: string,
  completed: number,
  failed: number,
  total: number,
) {
  broadcastJobEvent({
    type: 'batch:completed',
    batchId,
    documentTypeId,
    data: { status: 'completed', completed, failed, total },
    timestamp: new Date().toISOString(),
  })
}

export function emitBatchFailed(
  batchId: string,
  documentTypeId: string,
  error: string,
) {
  broadcastJobEvent({
    type: 'batch:failed',
    batchId,
    documentTypeId,
    data: { status: 'failed', error },
    timestamp: new Date().toISOString(),
  })
}
