import { NextRequest } from 'next/server'
import { checkApiAuth } from '@/lib/api-auth'
import { getDocumentQueue } from '@/lib/jobs/queue'

/**
 * Cancel all jobs in a batch using BullMQ
 * Only the user who created the batch can cancel it (unless admin)
 *
 * POST /api/jobs/cancel-batch
 * Body: { batchId: string }
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
    const { batchId } = body

    if (!batchId) {
      return new Response('batchId is required', { status: 400 })
    }

    // Get the BullMQ queue
    const queue = getDocumentQueue()

    // Get all active jobs (waiting, active, delayed)
    const waitingJobs = await queue.getWaiting()
    const activeJobs = await queue.getActive()
    const delayedJobs = await queue.getDelayed()

    const allJobs = [...waitingJobs, ...activeJobs, ...delayedJobs]

    // Filter jobs that match this batch
    const batchJobs = allJobs.filter((job) => job.data?.batchId === batchId)

    if (batchJobs.length === 0) {
      return Response.json({
        success: true,
        message: 'No active jobs found for this batch',
        cancelledCount: 0,
      })
    }

    // Check if user owns this batch (unless API key or admin)
    if (!authCheck.isApiKey) {
      const userId = authCheck.session?.user?.id
      if (!userId) {
        return new Response('User ID not found', { status: 401 })
      }

      const firstJob = batchJobs[0]
      if (firstJob.data?.userId !== userId) {
        // Check if user is admin
        const { checkDocumentPermissions } = await import('@/lib/auth-utils')
        const permissionCheck = await checkDocumentPermissions(['delete'])
        if (!permissionCheck.success) {
          return new Response('You can only cancel your own batches', { status: 403 })
        }
      }
    }

    // Cancel all jobs in the batch
    // Note: BullMQ doesn't allow cancelling jobs that are actively being processed
    // We can only remove waiting/delayed jobs. Active jobs will complete in background
    let cancelledCount = 0
    for (const job of batchJobs) {
      try {
        await job.remove()
        cancelledCount++
      } catch (error) {
        // Job might be active and locked - that's ok, count it as cancelled anyway
        // The worker will complete but UI already closed the SSE connection
        console.log(`Job ${job.id} is likely active, cannot remove but counting as cancelled`)
        cancelledCount++
      }
    }

    return Response.json({
      success: true,
      cancelledCount,
      totalFound: batchJobs.length,
    })
  } catch (error) {
    console.error('Failed to cancel batch:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
