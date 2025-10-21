/**
 * Job types and payloads for pg-boss queue
 */

export interface BatchProcessJobData {
  documentIds: string[]
  documentTypeId: string
  schema: string // JSON string
  overrideModel?: string
  userId: string
}

export interface BatchProcessJobResult {
  completed: string[]
  failed: Array<{ documentId: string; error: string }>
}

export interface SingleDocumentJobData {
  documentId: string
  documentTypeId: string
  schema: string // JSON string
  overrideModel?: string
  userId: string
  userName: string
  batchId: string // Groups related document jobs together
}

export interface SingleDocumentJobResult {
  documentId: string
  success: boolean
  error?: string
}

export const QUEUE_NAMES = {
  BATCH_PROCESS: 'batch-process-documents',
  SINGLE_DOCUMENT: 'process-single-document',
} as const

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES]
