import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../../../db'
import { job, batch } from '../../../db/schema/app'
import { nanoid } from 'nanoid'

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface JobProgress {
  percent: number
  partialData?: unknown
}

// ============================================
// Job Operations
// ============================================

export async function createJob(data: {
  documentId: string
  batchId?: string
  createdBy?: string
}) {
  const [result] = await db
    .insert(job)
    .values({
      id: nanoid(),
      documentId: data.documentId,
      batchId: data.batchId,
      status: 'pending',
      createdBy: data.createdBy,
    })
    .returning()

  return result
}

export async function getJob(id: string) {
  return db.query.job.findFirst({
    where: eq(job.id, id),
  })
}

export async function getJobByDocumentId(documentId: string) {
  return db.query.job.findFirst({
    where: eq(job.documentId, documentId),
  })
}

export async function getJobsByBatchId(batchId: string) {
  return db.query.job.findMany({
    where: eq(job.batchId, batchId),
  })
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
) {
  const [result] = await db
    .update(job)
    .set({
      status,
      progress: extra?.progress,
      error: extra?.error,
      startedAt: extra?.startedAt,
      completedAt: extra?.completedAt,
    })
    .where(eq(job.id, id))
    .returning()

  return result
}

export async function updateJobProgress(id: string, progress: JobProgress) {
  const [result] = await db
    .update(job)
    .set({ progress })
    .where(eq(job.id, id))
    .returning()

  return result
}

export async function deleteJob(id: string) {
  await db.delete(job).where(eq(job.id, id))
}

// ============================================
// Batch Operations
// ============================================

export async function createBatch(data: {
  documentTypeId: string
  documentIds: string[]
  webhookUrl?: string
  createdBy?: string
}) {
  // Create batch record
  const [batchResult] = await db
    .insert(batch)
    .values({
      documentTypeId: data.documentTypeId,
      total: String(data.documentIds.length),
      completed: '0',
      failed: '0',
      status: 'pending',
      webhookUrl: data.webhookUrl,
      createdBy: data.createdBy,
    })
    .returning()

  // Create jobs for each document
  const jobPromises = data.documentIds.map((documentId) =>
    createJob({
      documentId,
      batchId: batchResult.id,
      createdBy: data.createdBy,
    }),
  )

  const jobs = await Promise.all(jobPromises)

  return { batch: batchResult, jobs }
}

export async function getBatch(id: string) {
  return db.query.batch.findFirst({
    where: eq(batch.id, id),
  })
}

export async function getBatchWithJobs(id: string) {
  const batchResult = await db.query.batch.findFirst({
    where: eq(batch.id, id),
  })

  if (!batchResult) return null

  const jobs = await getJobsByBatchId(id)

  return { batch: batchResult, jobs }
}

export async function updateBatchStatus(id: string, status: BatchStatus) {
  const [result] = await db
    .update(batch)
    .set({
      status,
      completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
    })
    .where(eq(batch.id, id))
    .returning()

  return result
}

export async function updateBatchProgress(
  id: string,
  completed: number,
  failed: number,
) {
  const batchResult = await getBatch(id)
  if (!batchResult) return null

  const total = parseInt(batchResult.total)
  const isComplete = completed + failed >= total

  const [result] = await db
    .update(batch)
    .set({
      completed: String(completed),
      failed: String(failed),
      status: isComplete ? (failed > 0 ? 'completed' : 'completed') : 'processing',
      completedAt: isComplete ? new Date() : undefined,
    })
    .where(eq(batch.id, id))
    .returning()

  return result
}

export async function deleteBatch(id: string) {
  // Jobs will be cascade deleted due to FK constraint
  await db.delete(batch).where(eq(batch.id, id))
}

export async function cancelBatch(id: string) {
  // Update batch status
  const [result] = await db
    .update(batch)
    .set({
      status: 'cancelled',
      completedAt: new Date(),
    })
    .where(eq(batch.id, id))
    .returning()

  // Update pending jobs to failed
  await db
    .update(job)
    .set({
      status: 'failed',
      error: 'Batch cancelled',
      completedAt: new Date(),
    })
    .where(and(eq(job.batchId, id), eq(job.status, 'pending')))

  return result
}

// ============================================
// Query Helpers
// ============================================

export async function getPendingJobs(limit: number = 10) {
  return db.query.job.findMany({
    where: eq(job.status, 'pending'),
    limit,
    orderBy: (job, { asc }) => [asc(job.createdAt)],
  })
}

export async function getActiveBatches() {
  return db.query.batch.findMany({
    where: inArray(batch.status, ['pending', 'processing']),
  })
}
