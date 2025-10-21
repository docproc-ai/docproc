import { NextRequest } from 'next/server'
import { checkApiAuth } from '@/lib/api-auth'
import { QueueEvents } from 'bullmq'
import { Redis } from 'ioredis'

/**
 * Server-Sent Events endpoint for real-time BullMQ job updates
 *
 * GET /api/jobs/events?jobId=xxx  - Stream events for a single job
 * GET /api/jobs/events?batchId=xyz - Stream events for all jobs in a batch
 *
 * Streams job progress, completion, and failure events in real-time using SSE
 */
export async function GET(req: NextRequest) {
  // Check if user has permission
  const authCheck = await checkApiAuth({
    document: ['list'],
  })

  if (!authCheck.success) {
    return new Response('Insufficient permissions', { status: 403 })
  }

  const url = new URL(req.url)
  const batchId = url.searchParams.get('batchId')
  const jobId = url.searchParams.get('jobId')

  if (!batchId && !jobId) {
    return new Response('Either batchId or jobId query parameter is required', { status: 400 })
  }

  // Create SSE stream
  const encoder = new TextEncoder()

  let queueEvents: QueueEvents | null = null
  let connection: Redis | null = null

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Connect to Redis for listening to queue events
        const redisUrl = process.env.VALKEY_URL || process.env.REDIS_URL
        if (!redisUrl) {
          throw new Error('VALKEY_URL or REDIS_URL not configured')
        }

        connection = new Redis(redisUrl, {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        })

        queueEvents = new QueueEvents('document-processing', {
          connection,
        })

        // Send initial connected message
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'connected', batchId, jobId })}\n\n`)
        )

        // Listen for job completion
        queueEvents.on('completed', async ({ jobId: eventJobId, returnvalue }) => {
          try {
            // Filter by jobId if specified
            if (jobId && eventJobId !== jobId) {
              return
            }

            // Extract documentId from jobId
            const documentId = eventJobId.replace('process-doc-', '')

            // Check if this job belongs to our batch
            if (returnvalue?.documentId) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'completed',
                  documentId,
                  jobId: eventJobId,
                  success: returnvalue.success,
                  error: returnvalue.error,
                })}\n\n`)
              )
            }
          } catch (error) {
            console.error('Error handling completed event:', error)
          }
        })

        // Listen for job failures
        queueEvents.on('failed', async ({ jobId: eventJobId, failedReason }) => {
          try {
            // Filter by jobId if specified
            if (jobId && eventJobId !== jobId) {
              return
            }

            const documentId = eventJobId.replace('process-doc-', '')

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'failed',
                documentId,
                jobId: eventJobId,
                error: failedReason,
              })}\n\n`)
            )
          } catch (error) {
            console.error('Error handling failed event:', error)
          }
        })

        // Listen for job progress updates
        queueEvents.on('progress', async ({ jobId: eventJobId, data }) => {
          try {
            // Filter by jobId if specified
            if (jobId && eventJobId !== jobId) {
              return
            }

            const documentId = eventJobId.replace('process-doc-', '')

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'progress',
                documentId,
                jobId: eventJobId,
                progressData: data,
              })}\n\n`)
            )
          } catch (error) {
            console.error('Error handling progress event:', error)
          }
        })

        // Keep-alive ping every 30 seconds
        const keepAlive = setInterval(() => {
          controller.enqueue(encoder.encode(': keepalive\n\n'))
        }, 30000)

        // Cleanup on close
        req.signal.addEventListener('abort', () => {
          clearInterval(keepAlive)
          queueEvents?.close()
          connection?.quit()
          controller.close()
        })

      } catch (error) {
        console.error('Error setting up SSE stream:', error)
        controller.error(error)
      }
    },

    cancel() {
      queueEvents?.close()
      connection?.quit()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
