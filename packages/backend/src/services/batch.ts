import {
  getBatchWithJobs,
  getJob,
  getJobsByBatchId,
  updateBatchProgress,
  updateBatchStatus,
  updateJobStatus,
} from '../lib/db/job-operations'
import { processDocumentBatch } from '../lib/processing/batch-processor'
import {
  emitBatchCompleted,
  emitBatchFailed,
  emitBatchProgress,
  emitBatchStarted,
  emitJobCompleted,
  emitJobFailed,
  emitJobStarted,
} from '../lib/websocket'

/**
 * Process batch in background
 * Updates job and batch status as processing progresses
 * Emits WebSocket events for real-time progress tracking
 * Processes concurrently with configurable limit and checks for cancellation
 */
export async function processBatchInBackground(
  batchId: string,
  documentTypeId: string,
  documentIds: string[],
  webhookUrl?: string,
  concurrency?: number,
  overrideModel?: string,
) {
  try {
    await updateBatchStatus(batchId, 'processing')
    emitBatchStarted(batchId, documentTypeId, documentIds.length)

    const jobs = await getJobsByBatchId(batchId)
    const jobMap = new Map(
      jobs.filter((j) => j.documentId).map((j) => [j.documentId, j.id]),
    )

    let completed = 0
    let failed = 0
    let skipped = 0

    await processDocumentBatch(
      documentIds,
      { overrideModel },
      async (documentId) => {
        const jobId = jobMap.get(documentId)
        if (!jobId) return false

        const job = await getJob(jobId)
        if (!job || job.status === 'failed') {
          skipped++
          await updateBatchProgress(batchId, completed, failed + skipped)
          emitBatchProgress(
            batchId,
            documentTypeId,
            completed,
            failed + skipped,
            documentIds.length,
          )
          return false
        }

        await updateJobStatus(jobId, 'processing', { startedAt: new Date() })
        emitJobStarted(jobId, documentId, documentTypeId, batchId)
        return true
      },
      async (_completedCount, total, documentId, error) => {
        const jobId = jobMap.get(documentId)
        if (!jobId) return

        if (error) {
          failed++
          await updateJobStatus(jobId, 'failed', {
            error: error.message,
            completedAt: new Date(),
          })
          emitJobFailed(
            jobId,
            documentId,
            documentTypeId,
            error.message,
            batchId,
          )
        } else {
          completed++
          await updateJobStatus(jobId, 'completed', { completedAt: new Date() })
          emitJobCompleted(jobId, documentId, documentTypeId, batchId)
        }

        await updateBatchProgress(batchId, completed, failed + skipped)
        emitBatchProgress(
          batchId,
          documentTypeId,
          completed,
          failed + skipped,
          total,
        )
      },
      concurrency,
    )

    await updateBatchStatus(batchId, 'completed')
    emitBatchCompleted(
      batchId,
      documentTypeId,
      completed,
      failed + skipped,
      documentIds.length,
    )

    if (webhookUrl) {
      const batchResult = await getBatchWithJobs(batchId)
      if (batchResult) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'batch.completed',
              batchId,
              status: batchResult.batch.status,
              total: parseInt(batchResult.batch.total, 10),
              completed: parseInt(batchResult.batch.completed || '0', 10),
              failed: parseInt(batchResult.batch.failed || '0', 10),
            }),
          })
        } catch (webhookError) {
          console.error('Webhook call failed:', webhookError)
        }
      }
    }
  } catch (error) {
    console.error('Batch processing failed:', error)
    await updateBatchStatus(batchId, 'failed')
    emitBatchFailed(
      batchId,
      documentTypeId,
      error instanceof Error ? error.message : 'Unknown error',
    )
  }
}
