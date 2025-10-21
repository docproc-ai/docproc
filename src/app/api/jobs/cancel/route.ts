import { NextRequest } from 'next/server'
import { checkApiAuth } from '@/lib/api-auth'
import { getDocumentQueue } from '@/lib/jobs/queue'

/**
 * Cancel a single job by jobId
 * Only the user who created the job can cancel it (unless admin)
 *
 * POST /api/jobs/cancel
 * Body: { jobId: string }
 */
export async function POST(req: NextRequest) {
  try {
    // Check if user has permission
    const authCheck = await checkApiAuth({
      document: ['update'],
    })

    if (!authCheck.success) {
      return new Response('Insufficient permissions', { status: 403 })
    }

    const body = await req.json()
    const { jobId } = body

    if (!jobId) {
      return new Response('jobId is required', { status: 400 })
    }

    // Get the BullMQ queue
    const queue = getDocumentQueue()

    // Get the job
    const job = await queue.getJob(jobId)

    if (!job) {
      return Response.json({
        success: true,
        message: 'Job not found (may have already completed or been cancelled)',
      })
    }

    // Check if user owns this job (unless API key or admin)
    if (!authCheck.isApiKey) {
      const userId = authCheck.session?.user?.id
      if (!userId) {
        return new Response('User ID not found', { status: 401 })
      }

      if (job.data?.userId !== userId) {
        // Check if user is admin
        const { checkDocumentPermissions } = await import('@/lib/auth-utils')
        const permissionCheck = await checkDocumentPermissions(['delete'])
        if (!permissionCheck.success) {
          return new Response('You can only cancel your own jobs', { status: 403 })
        }
      }
    }

    // Cancel the job
    // Note: BullMQ doesn't allow cancelling jobs that are actively being processed by a worker
    // We can only remove waiting/delayed jobs. For active jobs, they'll complete in background
    // but the UI will close the SSE connection so the user won't see updates
    try {
      await job.remove()
    } catch (error) {
      // Job might be active and locked by worker - that's ok, just return success
      // The worker will complete but UI already closed the connection
      console.log(`Job ${jobId} is likely active, cannot remove but returning success`)
    }

    return Response.json({
      success: true,
      jobId,
    })
  } catch (error) {
    console.error('Failed to cancel job:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
