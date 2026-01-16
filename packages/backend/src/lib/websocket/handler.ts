import type { ServerWebSocket } from 'bun'
import {
  subscribeToJob,
  subscribeToBatch,
  unsubscribeAll,
  registerClient,
} from './job-events'

export interface WebSocketData {
  id: string
  subscriptions: string[]
}

/**
 * WebSocket message types from client
 */
interface SubscribeMessage {
  type: 'subscribe'
  jobId?: string
  batchId?: string
}

interface UnsubscribeMessage {
  type: 'unsubscribe'
  jobId?: string
  batchId?: string
}

interface PingMessage {
  type: 'ping'
}

type ClientMessage = SubscribeMessage | UnsubscribeMessage | PingMessage

/**
 * Handle incoming WebSocket messages
 */
export function handleWebSocketMessage(
  ws: ServerWebSocket<WebSocketData>,
  message: string | Buffer,
) {
  try {
    const data = JSON.parse(message.toString()) as ClientMessage

    switch (data.type) {
      case 'subscribe':
        if (data.jobId) {
          subscribeToJob(ws as unknown as WebSocket, data.jobId)
          ws.data.subscriptions.push(`job:${data.jobId}`)
        }
        if (data.batchId) {
          subscribeToBatch(ws as unknown as WebSocket, data.batchId)
          ws.data.subscriptions.push(`batch:${data.batchId}`)
        }
        ws.send(JSON.stringify({ type: 'subscribed', jobId: data.jobId, batchId: data.batchId }))
        break

      case 'unsubscribe':
        // For simplicity, just acknowledge - cleanup happens on close
        ws.send(JSON.stringify({ type: 'unsubscribed', jobId: data.jobId, batchId: data.batchId }))
        break

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }))
        break

      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }))
    }
  } catch (error) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }))
  }
}

/**
 * Handle WebSocket connection open
 */
export function handleWebSocketOpen(ws: ServerWebSocket<WebSocketData>) {
  console.log(`WebSocket connected: ${ws.data.id}`)
  // Register client to receive all job events
  registerClient(ws as unknown as WebSocket)
  ws.send(JSON.stringify({ type: 'connected', id: ws.data.id }))
}

/**
 * Handle WebSocket connection close
 */
export function handleWebSocketClose(ws: ServerWebSocket<WebSocketData>) {
  console.log(`WebSocket disconnected: ${ws.data.id}`)
  unsubscribeAll(ws as unknown as WebSocket)
}

/**
 * Create WebSocket upgrade handler for Bun
 */
export function createWebSocketHandler() {
  return {
    message: handleWebSocketMessage,
    open: handleWebSocketOpen,
    close: handleWebSocketClose,
  }
}
