import type PgBoss from 'pg-boss'
import { processAndSaveDocument } from '@/lib/document-processing/processor'
import type { SingleDocumentJobData, SingleDocumentJobResult } from '../types'
import { QUEUE_NAMES } from '../types'

/**
 * Worker function to process a single document
 * Designed to work with multiple concurrent workers (teamSize: 5)
 */
export async function processSingleDocumentJob(
  jobs: PgBoss.Job<SingleDocumentJobData>[],
): Promise<SingleDocumentJobResult> {
  // pg-boss passes an array of jobs, but we process one at a time
  const job = jobs[0]

  if (!job) {
    throw new Error('No job provided')
  }

  console.log('🔍 Single-document worker received job:', job.id)
  console.log('🔍 Job data:', job.data)

  if (!job.data) {
    throw new Error('Job data is undefined')
  }

  const { documentId, documentTypeId, schema, overrideModel, batchId, userId, userName } = job.data

  console.log(
    `📝 Processing document ${documentId} (batch: ${batchId}, user: ${userName})`
  )

  let parsedSchema
  try {
    parsedSchema = JSON.parse(schema)
  } catch (error) {
    console.error('Invalid schema JSON in job:', error)
    throw new Error('Invalid schema JSON')
  }

  try {
    // Process the single document
    await processAndSaveDocument(
      documentId,
      documentTypeId,
      parsedSchema,
      { overrideModel }
    )

    console.log(`✅ Successfully processed document ${documentId}`)

    return {
      documentId,
      success: true,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`❌ Failed to process document ${documentId}:`, errorMessage)

    return {
      documentId,
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Register the single-document processor worker with pg-boss
 * @param boss - pg-boss instance
 */
export async function registerSingleDocumentProcessor(boss: PgBoss): Promise<void> {
  // Create the queue if it doesn't exist
  await boss.createQueue(QUEUE_NAMES.SINGLE_DOCUMENT)

  console.log(`🔧 Registering worker for queue: ${QUEUE_NAMES.SINGLE_DOCUMENT}`)

  const workerId = await boss.work(
    QUEUE_NAMES.SINGLE_DOCUMENT,
    {
      teamSize: 5, // Process up to 5 documents concurrently
      teamConcurrency: 1, // Each worker processes one document at a time
    },
    processSingleDocumentJob,
  )

  console.log(`✅ Registered single-document processor worker (ID: ${workerId}) for queue: ${QUEUE_NAMES.SINGLE_DOCUMENT}`)
}
