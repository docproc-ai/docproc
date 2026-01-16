import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { streamText } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { processDocumentRequest, createBatchRequest } from '../../shared/schemas'
import {
  processAndSaveDocument,
  prepareDocumentForStreaming,
  closeBrackets,
  safeParseJson,
} from '../lib/processing'

// Initialize AI SDK OpenRouter provider for streaming
const openrouterProvider = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})
import { processDocumentBatch } from '../lib/processing/batch-processor'
import { getDocument } from '../lib/db/document-operations'
import { getDocumentType } from '../lib/db/document-type-operations'
import {
  createBatch,
  getBatch,
  getBatchWithJobs,
  updateBatchStatus,
  updateBatchProgress,
  cancelBatch,
  updateJobStatus,
  getJobsByBatchId,
} from '../lib/db/job-operations'
import {
  requireApiKeyOrAuth,
  requireAuth,
  requirePermission,
} from '../middleware/auth'
import {
  emitBatchStarted,
  emitBatchProgress,
  emitBatchCompleted,
  emitBatchFailed,
  emitJobStarted,
  emitJobCompleted,
  emitJobFailed,
} from '../lib/websocket'

export const processingRoutes = new Hono()
  .basePath('/api')

  // POST /api/process/stream - Process with text streaming and bracket closing
  // NOTE: Must come before /process/:documentId to avoid "stream" matching as a documentId
  .post(
    '/process/stream',
    requireApiKeyOrAuth,
    requirePermission('document', 'update'),
    zValidator('json', z.object({
      documentId: z.string().uuid(),
      model: z.string().optional(),
    })),
    async (c) => {
      const { documentId, model } = c.req.valid('json')

      // Verify document exists
      const doc = await getDocument(documentId)
      if (!doc) {
        return c.json({ error: 'Document not found' }, 404)
      }

      try {
        // Prepare document data for streaming
        const streamingContext = await prepareDocumentForStreaming(documentId, {
          overrideModel: model,
        })

        // Build prompt with schema included in text (works with all models)
        const schemaPrompt = `Please analyze the attached document and extract the data according to the provided schema.

Schema to follow:
${JSON.stringify(streamingContext.schema, null, 2)}

Remember: Output ONLY valid JSON that matches this schema. No explanatory text. Start with { and end with }.`

        return streamSSE(c, async (stream) => {
          let fullText = ''

          try {
            // Get image from prepared context
            const imageContent = streamingContext.messages[0].content[1]
            const imageData = imageContent.type === 'image' ? imageContent.image : ''

            const result = streamText({
              model: openrouterProvider(streamingContext.modelName),
              system: streamingContext.systemPrompt,
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: schemaPrompt },
                    { type: 'image', image: imageData },
                  ],
                },
              ],
            })

            // Stream text chunks
            for await (const chunk of result.textStream) {
              fullText += chunk

              // Try to parse with bracket closing for partial updates
              const parsed = safeParseJson(fullText)
              if (parsed) {
                await stream.writeSSE({
                  event: 'partial',
                  data: JSON.stringify(parsed),
                })
              }
            }

            // Final parse and save
            const finalData = safeParseJson(fullText)
            if (finalData) {
              await streamingContext.updateDocumentOnComplete(finalData)
              await stream.writeSSE({
                event: 'complete',
                data: JSON.stringify(finalData),
              })
            } else {
              await stream.writeSSE({
                event: 'error',
                data: 'Failed to parse extracted data',
              })
            }

            await stream.writeSSE({
              event: 'done',
              data: 'Processing complete',
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Processing failed'
            await stream.writeSSE({
              event: 'error',
              data: message,
            })
          }
        })
      } catch (error) {
        console.error('Streaming error:', error)
        const message = error instanceof Error ? error.message : 'Processing failed'
        return c.json({ error: message }, 500)
      }
    },
  )

  // POST /api/process/:documentId - Process single document (non-streaming)
  .post(
    '/process/:documentId',
    requireApiKeyOrAuth,
    requirePermission('document', 'update'),
    zValidator('param', z.object({ documentId: z.uuid() })),
    zValidator('json', processDocumentRequest.optional()),
    async (c) => {
      try {
        const { documentId } = c.req.valid('param')
        const body = c.req.valid('json')

        // Verify document exists
        const doc = await getDocument(documentId)
        if (!doc) {
          return c.json({ error: 'Document not found' }, 404)
        }

        // Check if already processed
        if (doc.status === 'processed' || doc.status === 'approved') {
          return c.json({ error: 'Document already processed' }, 400)
        }

        // Process document
        const { data, document } = await processAndSaveDocument(documentId, {
          overrideModel: body?.model,
        })

        return c.json({
          success: true,
          documentId,
          extractedData: data,
          status: document?.status,
        }, 200)
      } catch (error) {
        console.error('Failed to process document:', error)
        const message = error instanceof Error ? error.message : 'Processing failed'
        return c.json({ error: message }, 500)
      }
    },
  )

  // POST /api/batches - Create and start batch processing
  .post(
    '/batches',
    requireAuth,
    requirePermission('document', 'update'),
    zValidator('json', createBatchRequest),
    async (c) => {
      try {
        const { documentIds, webhookUrl } = c.req.valid('json')
        const user = c.get('user')

        // Verify all documents exist and get document type
        const documents = await Promise.all(documentIds.map((id) => getDocument(id)))
        const missingDocs = documentIds.filter((_, i) => !documents[i])

        if (missingDocs.length > 0) {
          return c.json({
            error: 'Some documents not found',
            missing: missingDocs,
          }, 400)
        }

        // All documents must be same document type
        const documentTypeId = documents[0]!.documentTypeId
        const differentTypes = documents.filter((d) => d!.documentTypeId !== documentTypeId)
        if (differentTypes.length > 0) {
          return c.json({
            error: 'All documents must be of the same document type',
          }, 400)
        }

        // Create batch and jobs
        const { batch, jobs } = await createBatch({
          documentTypeId,
          documentIds,
          webhookUrl,
          createdBy: user?.id,
        })

        // Start batch processing in background (don't await)
        processBatchInBackground(batch.id, documentIds, webhookUrl)

        return c.json({
          success: true,
          batchId: batch.id,
          total: documentIds.length,
          jobs: jobs.map((j) => ({ id: j.id, documentId: j.documentId })),
        }, 201)
      } catch (error) {
        console.error('Failed to create batch:', error)
        return c.json({ error: 'Failed to create batch' }, 500)
      }
    },
  )

  // GET /api/batches/:id - Get batch status
  .get(
    '/batches/:id',
    requireApiKeyOrAuth,
    zValidator('param', z.object({ id: z.string() })),
    async (c) => {
      try {
        const { id } = c.req.valid('param')

        const result = await getBatchWithJobs(id)
        if (!result) {
          return c.json({ error: 'Batch not found' }, 404)
        }

        return c.json({
          id: result.batch.id,
          status: result.batch.status,
          total: parseInt(result.batch.total),
          completed: parseInt(result.batch.completed || '0'),
          failed: parseInt(result.batch.failed || '0'),
          webhookUrl: result.batch.webhookUrl,
          createdAt: result.batch.createdAt,
          completedAt: result.batch.completedAt,
          jobs: result.jobs.map((j) => ({
            id: j.id,
            documentId: j.documentId,
            status: j.status,
            error: j.error,
            progress: j.progress,
          })),
        }, 200)
      } catch (error) {
        console.error('Failed to get batch:', error)
        return c.json({ error: 'Failed to get batch' }, 500)
      }
    },
  )

  // POST /api/batches/:id/cancel - Cancel batch
  .post(
    '/batches/:id/cancel',
    requireAuth,
    requirePermission('document', 'update'),
    zValidator('param', z.object({ id: z.string() })),
    async (c) => {
      try {
        const { id } = c.req.valid('param')

        const batch = await getBatch(id)
        if (!batch) {
          return c.json({ error: 'Batch not found' }, 404)
        }

        if (batch.status === 'completed' || batch.status === 'cancelled') {
          return c.json({ error: 'Batch already finished' }, 400)
        }

        await cancelBatch(id)

        return c.json({ success: true }, 200)
      } catch (error) {
        console.error('Failed to cancel batch:', error)
        return c.json({ error: 'Failed to cancel batch' }, 500)
      }
    },
  )

/**
 * Process batch in background
 * Updates job and batch status as processing progresses
 * Emits WebSocket events for real-time progress tracking
 */
async function processBatchInBackground(
  batchId: string,
  documentIds: string[],
  webhookUrl?: string,
) {
  try {
    // Update batch status to processing
    await updateBatchStatus(batchId, 'processing')
    emitBatchStarted(batchId, documentIds.length)

    // Get jobs for this batch
    const jobs = await getJobsByBatchId(batchId)
    const jobMap = new Map(jobs.map((j) => [j.documentId!, j.id]))

    let completed = 0
    let failed = 0

    // Emit job started events
    for (const [documentId, jobId] of jobMap) {
      emitJobStarted(jobId, documentId, batchId)
    }

    // Process with concurrency control
    await processDocumentBatch(
      documentIds,
      {},
      3, // concurrency
      async (completedCount, total, documentId, error) => {
        const jobId = jobMap.get(documentId)
        if (!jobId) return

        if (error) {
          failed++
          await updateJobStatus(jobId, 'failed', {
            error: error.message,
            completedAt: new Date(),
          })
          emitJobFailed(jobId, documentId, error.message, batchId)
        } else {
          completed++
          await updateJobStatus(jobId, 'completed', {
            completedAt: new Date(),
          })
          emitJobCompleted(jobId, documentId, batchId)
        }

        // Update batch progress
        await updateBatchProgress(batchId, completed, failed)
        emitBatchProgress(batchId, completed, failed, total)
      },
    )

    // Mark batch as complete
    await updateBatchStatus(batchId, 'completed')
    emitBatchCompleted(batchId, completed, failed, documentIds.length)

    // Call webhook if configured
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
              total: parseInt(batchResult.batch.total),
              completed: parseInt(batchResult.batch.completed || '0'),
              failed: parseInt(batchResult.batch.failed || '0'),
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
    emitBatchFailed(batchId, error instanceof Error ? error.message : 'Unknown error')
  }
}
