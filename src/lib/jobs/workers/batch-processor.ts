import type PgBoss from 'pg-boss'
import { processDocumentBatch } from '@/lib/document-processing/processor'
import type { BatchProcessJobData, BatchProcessJobResult } from '../types'
import { QUEUE_NAMES } from '../types'

/**
 * Worker function to process a batch of documents
 * Runs with concurrency control (max 5 documents at once)
 * Progress is tracked in-memory and returned as job output
 */
export async function processBatchJob(
  jobs: PgBoss.Job<BatchProcessJobData>[],
): Promise<BatchProcessJobResult & { completedCount: number; failedCount: number; errors: Array<{ documentId: string; error: string }> }> {
  // pg-boss passes an array of jobs, but we process one at a time
  const job = jobs[0]

  if (!job) {
    throw new Error('No job provided')
  }

  if (!job.data) {
    throw new Error('Job data is undefined')
  }

  const { documentIds, documentTypeId, schema, overrideModel } = job.data

  let parsedSchema
  try {
    parsedSchema = JSON.parse(schema)
  } catch (error) {
    console.error('Invalid schema JSON in batch job:', error)
    throw new Error('Invalid schema JSON')
  }

  // Track progress in memory
  let completedCount = 0
  const errors: Array<{ documentId: string; error: string }> = []

  // Process documents with concurrency limit
  const result = await processDocumentBatch(
    documentIds,
    documentTypeId,
    parsedSchema,
    { overrideModel },
    5, // Concurrency: process 5 documents at a time
    (completed, total, docId, error) => {
      // Update progress counters
      completedCount = completed
      if (error) {
        errors.push({ documentId: docId, error: error.message })
      }
    },
  )

  // Return result with progress - pg-boss automatically stores this in job.output
  return {
    ...result,
    completedCount,
    failedCount: errors.length,
    errors,
  }
}

/**
 * Register the batch processor worker with pg-boss
 * @param boss - pg-boss instance
 */
export async function registerBatchProcessor(boss: PgBoss): Promise<void> {
  // Create the queue if it doesn't exist
  await boss.createQueue(QUEUE_NAMES.BATCH_PROCESS)

  console.log(`🔧 Registering worker for queue: ${QUEUE_NAMES.BATCH_PROCESS}`)

  const workerId = await boss.work(
    QUEUE_NAMES.BATCH_PROCESS,
    {
      teamSize: 1, // Only one worker processes batch jobs at a time
      teamConcurrency: 1, // Process one batch at a time
      // Each document within the batch is processed with concurrency: 5
    },
    processBatchJob,
  )

  console.log(`✅ Registered batch processor worker (ID: ${workerId}) for queue: ${QUEUE_NAMES.BATCH_PROCESS}`)
}
