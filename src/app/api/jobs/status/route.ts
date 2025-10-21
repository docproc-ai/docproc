import { NextRequest } from 'next/server'
import { checkApiAuth } from '@/lib/api-auth'
import { getDocumentQueue } from '@/lib/jobs/queue'

/**
 * Query job status by job IDs
 *
 * GET /api/jobs/status?jobIds=process-doc-xxx,process-doc-yyy
 *
 * Returns status for multiple jobs at once, useful for API consumers
 * polling for completion after uploading with autoProcess=true
 */
export async function GET(req: NextRequest) {
  try {
    // Check if user has permission
    const authCheck = await checkApiAuth({
      document: ['list'],
    })

    if (!authCheck.success) {
      return new Response('Insufficient permissions', { status: 403 })
    }

    const url = new URL(req.url)
    const jobIdsParam = url.searchParams.get('jobIds')

    if (!jobIdsParam) {
      return new Response('jobIds query parameter is required (comma-separated)', { status: 400 })
    }

    // Parse comma-separated job IDs
    const jobIds = jobIdsParam.split(',').map(id => id.trim()).filter(Boolean)

    if (jobIds.length === 0) {
      return new Response('At least one job ID is required', { status: 400 })
    }

    const queue = getDocumentQueue()
    const jobs = []

    // Query each job
    for (const jobId of jobIds) {
      try {
        const job = await queue.getJob(jobId)

        if (!job) {
          // Job not found (might have been completed and removed, or never existed)
          jobs.push({
            jobId,
            status: 'not_found',
            message: 'Job not found. It may have completed and been removed from the queue.',
          })
          continue
        }

        const state = await job.getState()
        const progress = job.progress
        const documentId = jobId.replace('process-doc-', '')

        // Build job status response
        const jobStatus: any = {
          jobId,
          documentId,
          status: state,
        }

        // Add progress data if available
        if (typeof progress === 'object' && progress !== null) {
          jobStatus.progress = progress
        } else if (typeof progress === 'number') {
          jobStatus.progressPercent = progress
        }

        // Add failure reason if failed
        if (state === 'failed' && job.failedReason) {
          jobStatus.error = job.failedReason
        }

        // Add return value if completed
        if (state === 'completed' && job.returnvalue) {
          jobStatus.result = job.returnvalue
        }

        jobs.push(jobStatus)
      } catch (error) {
        console.error(`Failed to get status for job ${jobId}:`, error)
        jobs.push({
          jobId,
          status: 'error',
          error: 'Failed to query job status',
        })
      }
    }

    return Response.json({ jobs })
  } catch (error) {
    console.error('Failed to query job status:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
