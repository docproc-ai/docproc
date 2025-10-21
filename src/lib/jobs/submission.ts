import { getDocumentQueue, getDocumentWorker } from './queue'
import type { DocumentJobData } from './workers/document-processor'
import { randomUUID } from 'crypto'

/**
 * Options for queueing document processing jobs
 */
export interface QueueDocumentOptions {
  documentIds: string[]
  documentTypeId: string
  schema: any // Already parsed JSON object
  userId: string
  userName: string
  overrideModel?: string
  skipValidation?: boolean
  batchId?: string // Optional: provide your own batch ID, or one will be generated
  enableStreaming?: boolean // Enable streaming for real-time progress (default: false)
}

/**
 * Result of queueing document processing jobs
 */
export interface QueueDocumentResult {
  jobIds: string[]
  batchId: string
  totalCount: number
}

/**
 * Shared service for submitting document processing jobs to BullMQ
 *
 * This centralizes all job submission logic to ensure consistency across:
 * - Single document processing
 * - Batch processing
 * - Upload with autoProcess
 *
 * @param options - Job configuration options
 * @returns Job IDs and batch ID for tracking
 */
export async function queueDocumentProcessing(
  options: QueueDocumentOptions
): Promise<QueueDocumentResult> {
  const {
    documentIds,
    documentTypeId,
    schema,
    userId,
    userName,
    overrideModel,
    skipValidation = false,
    batchId = randomUUID(), // Generate batch ID if not provided
    enableStreaming = false, // Default to non-streaming for efficiency
  } = options

  // Validate inputs
  if (!documentIds || documentIds.length === 0) {
    throw new Error('documentIds array is required and must not be empty')
  }

  if (!documentTypeId || !schema) {
    throw new Error('documentTypeId and schema are required')
  }

  if (!userId || !userName) {
    throw new Error('userId and userName are required')
  }

  // Start the BullMQ worker if not already running
  await getDocumentWorker()

  // Get the BullMQ queue
  const queue = getDocumentQueue()
  const jobIds: string[] = []

  // Submit individual jobs for each document
  for (const documentId of documentIds) {
    const jobData: DocumentJobData = {
      documentId,
      documentTypeId,
      schema,
      overrideModel,
      skipValidation,
      userId,
      userName,
      batchId,
      enableStreaming,
    }

    const job = await queue.add('process-document', jobData, {
      jobId: `process-doc-${documentId}`, // Predictable ID prevents duplicate processing
      removeOnComplete: true, // Remove after 24h (set in queue defaults)
      removeOnFail: false, // Keep failed jobs for 7 days
    })

    jobIds.push(job.id!)
  }

  return {
    jobIds,
    batchId,
    totalCount: documentIds.length,
  }
}
