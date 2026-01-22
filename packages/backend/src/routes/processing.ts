import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { streamSSE } from 'hono/streaming'
import { streamText } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { processDocumentRequest, createBatchRequest } from '../schemas'
import {
  processAndSaveDocument,
  prepareDocumentForStreaming,
  safeParseJson,
} from '../lib/processing'

// Initialize AI SDK OpenRouter provider for streaming
const openrouterProvider = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})
import { processDocumentBatch } from '../lib/processing/batch-processor'
import { getDocument } from '../lib/db/document-operations'
import {
  createBatch,
  createJob,
  getBatch,
  getBatchWithJobs,
  getJob,
  updateBatchStatus,
  updateBatchProgress,
  cancelBatch,
  cancelJob,
  updateJobStatus,
  getJobsByBatchId,
  getActiveJobsForDocumentType,
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
  emitJobProgress,
  emitJobCompleted,
  emitJobFailed,
} from '../lib/websocket'

// Shared schemas
const errorResponse = z.object({ error: z.string() })
const successResponse = z.object({ success: z.boolean() })

// Route definitions
const streamProcessRoute = createRoute({
  method: 'post',
  path: '/process/stream',
  tags: ['Processing'],
  summary: 'Process document with SSE streaming',
  middleware: [requireApiKeyOrAuth, requirePermission('document', 'update')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            documentId: z.string().uuid(),
            model: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: 'SSE stream of processing events' },
    404: { description: 'Not found', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Server error', content: { 'application/json': { schema: errorResponse } } },
  },
})

const processDocumentRoute = createRoute({
  method: 'post',
  path: '/process/{documentId}',
  tags: ['Processing'],
  summary: 'Process a single document (non-streaming)',
  middleware: [requireApiKeyOrAuth, requirePermission('document', 'update')] as const,
  request: {
    params: z.object({ documentId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: processDocumentRequest.optional() } } },
  },
  responses: {
    200: {
      description: 'Processing result',
      content: { 'application/json': { schema: z.object({
        success: z.boolean(),
        documentId: z.string(),
        extractedData: z.any(),
        status: z.string().optional(),
      }) } },
    },
    400: { description: 'Bad request', content: { 'application/json': { schema: errorResponse } } },
    404: { description: 'Not found', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Server error', content: { 'application/json': { schema: errorResponse } } },
  },
})

const createBatchRoute = createRoute({
  method: 'post',
  path: '/batches',
  tags: ['Batches'],
  summary: 'Create and start batch processing',
  middleware: [requireAuth, requirePermission('document', 'update')] as const,
  request: {
    body: { content: { 'application/json': { schema: createBatchRequest } } },
  },
  responses: {
    201: {
      description: 'Batch created',
      content: { 'application/json': { schema: z.object({
        success: z.boolean(),
        batchId: z.string(),
        total: z.number(),
        jobs: z.array(z.object({ id: z.string(), documentId: z.string().nullable() })),
      }) } },
    },
    400: { description: 'Bad request', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Server error', content: { 'application/json': { schema: errorResponse } } },
  },
})

const getBatchRoute = createRoute({
  method: 'get',
  path: '/batches/{id}',
  tags: ['Batches'],
  summary: 'Get batch status',
  middleware: [requireApiKeyOrAuth] as const,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Batch details', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'Not found', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Server error', content: { 'application/json': { schema: errorResponse } } },
  },
})

const cancelBatchRoute = createRoute({
  method: 'post',
  path: '/batches/{id}/cancel',
  tags: ['Batches'],
  summary: 'Cancel a batch',
  middleware: [requireAuth, requirePermission('document', 'update')] as const,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Batch cancelled', content: { 'application/json': { schema: successResponse } } },
    400: { description: 'Bad request', content: { 'application/json': { schema: errorResponse } } },
    404: { description: 'Not found', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Server error', content: { 'application/json': { schema: errorResponse } } },
  },
})

const getActiveJobsRoute = createRoute({
  method: 'get',
  path: '/jobs/active',
  tags: ['Jobs'],
  summary: 'Get active jobs for a document type',
  middleware: [requireApiKeyOrAuth] as const,
  request: {
    query: z.object({ documentTypeId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'Active jobs',
      content: { 'application/json': { schema: z.object({
        jobs: z.array(z.object({
          id: z.string(),
          documentId: z.string().nullable(),
          batchId: z.string().nullable(),
          status: z.string(),
        })),
      }) } },
    },
    500: { description: 'Server error', content: { 'application/json': { schema: errorResponse } } },
  },
})

const cancelJobRoute = createRoute({
  method: 'post',
  path: '/jobs/{id}/cancel',
  tags: ['Jobs'],
  summary: 'Cancel a specific job',
  middleware: [requireAuth, requirePermission('document', 'update')] as const,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Job cancelled',
      content: { 'application/json': { schema: z.object({
        success: z.boolean(),
        job: z.object({
          id: z.string(),
          documentId: z.string().nullable(),
          status: z.string(),
        }),
      }) } },
    },
    404: { description: 'Not found', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Server error', content: { 'application/json': { schema: errorResponse } } },
  },
})

// Create router and register routes
export const processingRoutes = new OpenAPIHono()

  .openapi(streamProcessRoute, async (c) => {
    const { documentId, model } = c.req.valid('json')
    const user = c.get('user')

    const doc = await getDocument(documentId)
    if (!doc) {
      return c.json({ error: 'Document not found' }, 404)
    }

    const job = await createJob({
      documentId,
      documentTypeId: doc.documentTypeId,
      createdBy: user?.id,
    })

    await updateJobStatus(job.id, 'processing', { startedAt: new Date() })
    emitJobStarted(job.id, documentId, doc.documentTypeId)

    try {
      const streamingContext = await prepareDocumentForStreaming(documentId, {
        overrideModel: model,
      })

      const schemaPrompt = `Please analyze the attached document and extract the data according to the provided schema.

Schema to follow:
${JSON.stringify(streamingContext.schema, null, 2)}

Remember: Output ONLY valid JSON that matches this schema. No explanatory text. Start with { and end with }.`

      return streamSSE(c, async (stream) => {
        let fullText = ''

        await stream.writeSSE({
          event: 'started',
          data: JSON.stringify({ jobId: job.id }),
        })

        try {
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

          for await (const chunk of result.textStream) {
            fullText += chunk
            const parsed = safeParseJson(fullText)
            if (parsed) {
              emitJobProgress(job.id, documentId, doc.documentTypeId, 50, parsed)
              await stream.writeSSE({
                event: 'partial',
                data: JSON.stringify(parsed),
              })
            }
          }

          const finalData = safeParseJson(fullText)
          if (finalData) {
            await streamingContext.updateDocumentOnComplete(finalData)
            await updateJobStatus(job.id, 'completed', { completedAt: new Date() })
            emitJobCompleted(job.id, documentId, doc.documentTypeId)
            await stream.writeSSE({
              event: 'complete',
              data: JSON.stringify(finalData),
            })
          } else {
            await updateJobStatus(job.id, 'failed', {
              error: 'Failed to parse extracted data',
              completedAt: new Date(),
            })
            emitJobFailed(job.id, documentId, doc.documentTypeId, 'Failed to parse extracted data')
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
          await updateJobStatus(job.id, 'failed', {
            error: message,
            completedAt: new Date(),
          })
          emitJobFailed(job.id, documentId, doc.documentTypeId, message)
          await stream.writeSSE({
            event: 'error',
            data: message,
          })
        }
      })
    } catch (error) {
      console.error('Streaming error:', error)
      const message = error instanceof Error ? error.message : 'Processing failed'
      await updateJobStatus(job.id, 'failed', {
        error: message,
        completedAt: new Date(),
      })
      emitJobFailed(job.id, documentId, doc.documentTypeId, message)
      return c.json({ error: message }, 500)
    }
  })

  .openapi(processDocumentRoute, async (c) => {
    try {
      const { documentId } = c.req.valid('param')
      const body = c.req.valid('json')

      const doc = await getDocument(documentId)
      if (!doc) {
        return c.json({ error: 'Document not found' }, 404)
      }

      if (doc.status === 'processed' || doc.status === 'approved') {
        return c.json({ error: 'Document already processed' }, 400)
      }

      const { data, document } = await processAndSaveDocument(documentId, {
        overrideModel: body?.model,
      })

      return c.json(
        {
          success: true,
          documentId,
          extractedData: data,
          status: document?.status ?? undefined,
        },
        200,
      )
    } catch (error) {
      console.error('Failed to process document:', error)
      const message = error instanceof Error ? error.message : 'Processing failed'
      return c.json({ error: message }, 500)
    }
  })

  .openapi(createBatchRoute, async (c) => {
    try {
      const { documentIds, webhookUrl, concurrency } = c.req.valid('json')
      const user = c.get('user')

      const documents = await Promise.all(documentIds.map((id) => getDocument(id)))
      const missingDocs = documentIds.filter((_, i) => !documents[i])

      if (missingDocs.length > 0) {
        return c.json({ error: 'Some documents not found', missing: missingDocs }, 400)
      }

      const documentTypeId = documents[0]?.documentTypeId
      if (!documentTypeId) {
        return c.json({ error: 'Could not determine document type' }, 400)
      }
      const differentTypes = documents.filter((d) => d?.documentTypeId !== documentTypeId)
      if (differentTypes.length > 0) {
        return c.json({ error: 'All documents must be of the same document type' }, 400)
      }

      const { batch, jobs } = await createBatch({
        documentTypeId,
        documentIds,
        webhookUrl,
        createdBy: user?.id,
      })

      processBatchInBackground(batch.id, documentTypeId, documentIds, webhookUrl, concurrency)

      return c.json(
        {
          success: true,
          batchId: batch.id,
          total: documentIds.length,
          jobs: jobs.map((j) => ({ id: j.id, documentId: j.documentId })),
        },
        201,
      )
    } catch (error) {
      console.error('Failed to create batch:', error)
      return c.json({ error: 'Failed to create batch' }, 500)
    }
  })

  .openapi(getBatchRoute, async (c) => {
    try {
      const { id } = c.req.valid('param')
      const result = await getBatchWithJobs(id)
      if (!result) {
        return c.json({ error: 'Batch not found' }, 404)
      }

      return c.json(
        {
          id: result.batch.id,
          status: result.batch.status,
          total: parseInt(result.batch.total, 10),
          completed: parseInt(result.batch.completed || '0', 10),
          failed: parseInt(result.batch.failed || '0', 10),
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
        },
        200,
      )
    } catch (error) {
      console.error('Failed to get batch:', error)
      return c.json({ error: 'Failed to get batch' }, 500)
    }
  })

  .openapi(cancelBatchRoute, async (c) => {
    try {
      const { id } = c.req.valid('param')
      const batch = await getBatch(id)
      if (!batch) {
        return c.json({ error: 'Batch not found' }, 404)
      }

      if (batch.status === 'completed' || batch.status === 'cancelled') {
        return c.json({ error: 'Batch already finished' }, 400)
      }

      const result = await cancelBatch(id)
      if (!result) {
        return c.json({ error: 'Failed to cancel batch' }, 500)
      }

      for (const job of result.cancelledJobs) {
        if (job.documentId) {
          emitJobFailed(job.id, job.documentId, result.batch.documentTypeId, 'Batch cancelled', job.batchId)
        }
      }

      return c.json({ success: true }, 200)
    } catch (error) {
      console.error('Failed to cancel batch:', error)
      return c.json({ error: 'Failed to cancel batch' }, 500)
    }
  })

  .openapi(getActiveJobsRoute, async (c) => {
    try {
      const { documentTypeId } = c.req.valid('query')
      const jobs = await getActiveJobsForDocumentType(documentTypeId)

      return c.json(
        {
          jobs: jobs.map((j) => ({
            id: j.id,
            documentId: j.documentId ?? null,
            batchId: j.batchId ?? null,
            status: j.status,
          })),
        },
        200,
      )
    } catch (error) {
      console.error('Failed to get active jobs:', error)
      return c.json({ error: 'Failed to get active jobs' }, 500)
    }
  })

  .openapi(cancelJobRoute, async (c) => {
    try {
      const { id } = c.req.valid('param')
      const job = await getJob(id)

      if (!job) {
        return c.json({ error: 'Job not found' }, 404)
      }

      const cancelled = await cancelJob(id)
      if (!cancelled) {
        return c.json({ error: 'Failed to cancel job' }, 500)
      }

      let documentTypeId: string | undefined
      if (cancelled.batchId) {
        const batch = await getBatch(cancelled.batchId)
        documentTypeId = batch?.documentTypeId
      }

      if (documentTypeId && cancelled.documentId) {
        emitJobFailed(cancelled.id, cancelled.documentId, documentTypeId, 'Job cancelled', cancelled.batchId)
      }

      return c.json(
        {
          success: true,
          job: {
            id: cancelled.id,
            documentId: cancelled.documentId,
            status: cancelled.status,
          },
        },
        200,
      )
    } catch (error) {
      console.error('Failed to cancel job:', error)
      return c.json({ error: 'Failed to cancel job' }, 500)
    }
  })

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
          emitBatchProgress(batchId, documentTypeId, completed, failed + skipped, documentIds.length)
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
          await updateJobStatus(jobId, 'failed', { error: error.message, completedAt: new Date() })
          emitJobFailed(jobId, documentId, documentTypeId, error.message, batchId)
        } else {
          completed++
          await updateJobStatus(jobId, 'completed', { completedAt: new Date() })
          emitJobCompleted(jobId, documentId, documentTypeId, batchId)
        }

        await updateBatchProgress(batchId, completed, failed + skipped)
        emitBatchProgress(batchId, documentTypeId, completed, failed + skipped, total)
      },
      concurrency,
    )

    await updateBatchStatus(batchId, 'completed')
    emitBatchCompleted(batchId, documentTypeId, completed, failed + skipped, documentIds.length)

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
    emitBatchFailed(batchId, documentTypeId, error instanceof Error ? error.message : 'Unknown error')
  }
}
