import { NextRequest } from 'next/server'
import { checkApiAuth } from '@/lib/api-auth'
import { getDocumentQueue } from '@/lib/jobs/queue'

/**
 * Query job status for multiple documents using BullMQ
 * Used for cross-session visibility of processing status
 *
 * GET /api/jobs/by-documents?documentIds=id1,id2,id3
 *
 * Returns: { documentId: { status, userId, userName, jobId, progress } }
 */
export async function GET(req: NextRequest) {
  try {
    // Check if user has permission to read documents
    const authCheck = await checkApiAuth({
      document: ['list'],
    })

    if (!authCheck.success) {
      return new Response('Insufficient permissions', { status: 403 })
    }

    // Parse document IDs from query params
    const url = new URL(req.url)
    const documentIdsParam = url.searchParams.get('documentIds')

    if (!documentIdsParam) {
      return new Response('documentIds query parameter is required', { status: 400 })
    }

    const documentIds = documentIdsParam.split(',').filter(id => id.trim())

    if (documentIds.length === 0) {
      return Response.json({})
    }

    // Build job IDs from document IDs
    const jobIds = documentIds.map(id => `process-doc-${id}`)

    // Get the BullMQ queue
    const queue = getDocumentQueue()

    const jobStatuses: Record<string, {
      status: string
      userId: string
      userName: string
      jobId: string
      progress?: number
    }> = {}

    // Query each job - BullMQ makes this fast with Redis
    for (const jobId of jobIds) {
      try {
        const job = await queue.getJob(jobId)

        if (job) {
          const state = await job.getState()

          // Only include jobs that are NOT completed/failed (exclude finished states)
          if (!['completed', 'failed'].includes(state)) {
            const documentId = jobId.replace('process-doc-', '')

            jobStatuses[documentId] = {
              status: state,
              userId: job.data.userId || 'unknown',
              userName: job.data.userName || 'Unknown User',
              jobId: job.id!,
              progress: job.progress as number || 0,
            }
          }
        }
      } catch (error) {
        // Job doesn't exist or error querying - skip it
        console.debug(`Could not find job ${jobId}:`, error)
      }
    }

    return Response.json(jobStatuses)
  } catch (error) {
    console.error('Failed to query job statuses:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
