import { NextRequest } from 'next/server'
import { checkApiAuth } from '@/lib/api-auth'
import { getBoss } from '@/lib/jobs/boss'
import type { BatchProcessJobData } from '@/lib/jobs/types'
import { QUEUE_NAMES } from '@/lib/jobs/types'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    // Check if user has permission to view jobs
    const authCheck = await checkApiAuth({
      document: ['list'],
    })

    if (!authCheck.success) {
      console.error('Job status auth check failed:', authCheck)
      return new Response('Insufficient permissions to view jobs', { status: 403 })
    }

    const { jobId } = await params

    if (!jobId) {
      return new Response('Job ID is required', { status: 400 })
    }

    // Get job from pg-boss using built-in API
    const boss = await getBoss()
    const job = await boss.getJobById(QUEUE_NAMES.BATCH_PROCESS, jobId)

    if (!job) {
      return new Response('Job not found', { status: 404 })
    }

    const jobData = job.data as BatchProcessJobData
    const jobOutput = job.output as any

    // Check if user has permission to view this job (unless using API key)
    if (!authCheck.isApiKey && authCheck.session?.user?.id !== jobData.userId) {
      // Users can only view their own jobs (unless admin)
      const { checkDocumentPermissions } = await import('@/lib/auth-utils')
      const permissionCheck = await checkDocumentPermissions(['read'])
      if (!permissionCheck.success) {
        console.error('User is not admin and cannot view other users\' jobs')
        return new Response('Insufficient permissions to view this job', { status: 403 })
      }
    }

    // Map pg-boss state to our status
    const statusMap: Record<string, string> = {
      'created': 'pending',
      'retry': 'pending',
      'active': 'processing',
      'completed': 'completed',
      'cancelled': 'failed',
      'failed': 'failed',
    }

    return Response.json({
      id: job.id,
      status: statusMap[job.state] || 'pending',
      totalCount: jobData.documentIds.length,
      completedCount: jobOutput?.completedCount || 0,
      failedCount: jobOutput?.failedCount || 0,
      errors: jobOutput?.errors || [],
      createdAt: job.createdOn,
      completedAt: job.completedOn,
    })
  } catch (error) {
    console.error('Failed to get job status:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
