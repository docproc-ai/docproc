import { nanoid } from 'nanoid'

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type BatchStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface JobProgress {
  percent: number
  partialData?: unknown
}

export interface Job {
  id: string
  documentId: string
  batchId?: string
  status: JobStatus
  progress?: JobProgress
  error?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  createdBy?: string
}

export interface Batch {
  id: string
  documentTypeId: string
  total: string
  completed: string
  failed: string
  status: BatchStatus
  webhookUrl?: string
  createdAt: Date
  completedAt?: Date
  createdBy?: string
}

// In-memory storage for batches and jobs
const batches = new Map<string, Batch>()
const jobs = new Map<string, Job>()

// Auto-cleanup completed batches after 1 hour
const BATCH_TTL = 60 * 60 * 1000

function scheduleCleanup(batchId: string) {
  setTimeout(() => {
    const batch = batches.get(batchId)
    if (
      batch &&
      (batch.status === 'completed' ||
        batch.status === 'failed' ||
        batch.status === 'cancelled')
    ) {
      // Delete batch and its jobs
      for (const [jobId, job] of jobs) {
        if (job.batchId === batchId) {
          jobs.delete(jobId)
        }
      }
      batches.delete(batchId)
    }
  }, BATCH_TTL)
}

// ============================================
// Job Operations
// ============================================

export async function createJob(data: {
  documentId: string
  batchId?: string
  createdBy?: string
}): Promise<Job> {
  const job: Job = {
    id: nanoid(),
    documentId: data.documentId,
    batchId: data.batchId,
    status: 'pending',
    createdAt: new Date(),
    createdBy: data.createdBy,
  }
  jobs.set(job.id, job)
  return job
}

export async function getJob(id: string): Promise<Job | undefined> {
  return jobs.get(id)
}

export async function getJobByDocumentId(
  documentId: string,
): Promise<Job | undefined> {
  for (const job of jobs.values()) {
    if (job.documentId === documentId) {
      return job
    }
  }
  return undefined
}

export async function getJobsByBatchId(batchId: string): Promise<Job[]> {
  const result: Job[] = []
  for (const job of jobs.values()) {
    if (job.batchId === batchId) {
      result.push(job)
    }
  }
  return result
}

export async function updateJobStatus(
  id: string,
  status: JobStatus,
  extra?: {
    progress?: JobProgress
    error?: string
    startedAt?: Date
    completedAt?: Date
  },
): Promise<Job | undefined> {
  const job = jobs.get(id)
  if (!job) return undefined

  job.status = status
  if (extra?.progress) job.progress = extra.progress
  if (extra?.error) job.error = extra.error
  if (extra?.startedAt) job.startedAt = extra.startedAt
  if (extra?.completedAt) job.completedAt = extra.completedAt

  return job
}

export async function updateJobProgress(
  id: string,
  progress: JobProgress,
): Promise<Job | undefined> {
  const job = jobs.get(id)
  if (!job) return undefined

  job.progress = progress
  return job
}

export async function deleteJob(id: string): Promise<void> {
  jobs.delete(id)
}

export async function cancelJob(id: string): Promise<Job | undefined> {
  const job = jobs.get(id)
  if (!job) return undefined

  // Only cancel if pending or processing
  if (job.status !== 'pending' && job.status !== 'processing') {
    return job
  }

  job.status = 'failed'
  job.error = 'Cancelled by user'
  job.completedAt = new Date()

  // Update batch progress if this job belongs to a batch
  if (job.batchId) {
    const batch = batches.get(job.batchId)
    if (batch) {
      const batchJobs = await getJobsByBatchId(job.batchId)
      const completed = batchJobs.filter((j) => j.status === 'completed').length
      const failed = batchJobs.filter((j) => j.status === 'failed').length
      await updateBatchProgress(job.batchId, completed, failed)
    }
  }

  return job
}

// ============================================
// Batch Operations
// ============================================

export async function createBatch(data: {
  documentTypeId: string
  documentIds: string[]
  webhookUrl?: string
  createdBy?: string
}): Promise<{ batch: Batch; jobs: Job[] }> {
  const batch: Batch = {
    id: nanoid(),
    documentTypeId: data.documentTypeId,
    total: String(data.documentIds.length),
    completed: '0',
    failed: '0',
    status: 'pending',
    webhookUrl: data.webhookUrl,
    createdAt: new Date(),
    createdBy: data.createdBy,
  }
  batches.set(batch.id, batch)

  // Create jobs for each document
  const createdJobs: Job[] = []
  for (const documentId of data.documentIds) {
    const job = await createJob({
      documentId,
      batchId: batch.id,
      createdBy: data.createdBy,
    })
    createdJobs.push(job)
  }

  return { batch, jobs: createdJobs }
}

export async function getBatch(id: string): Promise<Batch | undefined> {
  return batches.get(id)
}

export async function getBatchWithJobs(
  id: string,
): Promise<{ batch: Batch; jobs: Job[] } | null> {
  const batch = batches.get(id)
  if (!batch) return null

  const batchJobs = await getJobsByBatchId(id)
  return { batch, jobs: batchJobs }
}

export async function updateBatchStatus(
  id: string,
  status: BatchStatus,
): Promise<Batch | undefined> {
  const batch = batches.get(id)
  if (!batch) return undefined

  batch.status = status
  if (status === 'completed' || status === 'failed') {
    batch.completedAt = new Date()
    scheduleCleanup(id)
  }

  return batch
}

export async function updateBatchProgress(
  id: string,
  completed: number,
  failed: number,
): Promise<Batch | undefined> {
  const batch = batches.get(id)
  if (!batch) return undefined

  const total = parseInt(batch.total, 10)
  const isComplete = completed + failed >= total

  batch.completed = String(completed)
  batch.failed = String(failed)
  batch.status = isComplete ? 'completed' : 'processing'
  if (isComplete) {
    batch.completedAt = new Date()
    scheduleCleanup(id)
  }

  return batch
}

export async function deleteBatch(id: string): Promise<void> {
  // Delete jobs first
  for (const [jobId, job] of jobs) {
    if (job.batchId === id) {
      jobs.delete(jobId)
    }
  }
  batches.delete(id)
}

export async function cancelBatch(
  id: string,
): Promise<{ batch: Batch; cancelledJobs: Job[] } | undefined> {
  const batch = batches.get(id)
  if (!batch) return undefined

  batch.status = 'cancelled'
  batch.completedAt = new Date()

  // Update pending/processing jobs to failed and collect them
  const cancelledJobs: Job[] = []
  for (const job of jobs.values()) {
    if (
      job.batchId === id &&
      (job.status === 'pending' || job.status === 'processing')
    ) {
      job.status = 'failed'
      job.error = 'Batch cancelled'
      job.completedAt = new Date()
      cancelledJobs.push(job)
    }
  }

  scheduleCleanup(id)
  return { batch, cancelledJobs }
}

// ============================================
// Query Helpers
// ============================================

export async function getPendingJobs(limit: number = 10): Promise<Job[]> {
  const pending: Job[] = []
  for (const job of jobs.values()) {
    if (job.status === 'pending') {
      pending.push(job)
      if (pending.length >= limit) break
    }
  }
  return pending.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

export async function getActiveBatches(): Promise<Batch[]> {
  const active: Batch[] = []
  for (const batch of batches.values()) {
    if (batch.status === 'pending' || batch.status === 'processing') {
      active.push(batch)
    }
  }
  return active
}

export async function getActiveJobs(): Promise<Job[]> {
  const active: Job[] = []
  for (const job of jobs.values()) {
    if (job.status === 'pending' || job.status === 'processing') {
      active.push(job)
    }
  }
  return active
}

export async function getActiveJobsForDocumentType(
  documentTypeId: string,
): Promise<Job[]> {
  // Get active batches for this document type
  const activeBatchIds = new Set<string>()
  for (const batch of batches.values()) {
    if (
      batch.documentTypeId === documentTypeId &&
      (batch.status === 'pending' || batch.status === 'processing')
    ) {
      activeBatchIds.add(batch.id)
    }
  }

  // Get jobs from those batches
  const active: Job[] = []
  for (const job of jobs.values()) {
    if (
      job.batchId &&
      activeBatchIds.has(job.batchId) &&
      (job.status === 'pending' || job.status === 'processing')
    ) {
      active.push(job)
    }
  }
  return active
}
