/**
 * Document services shared by the REST routes and the MCP tools.
 * Transport-agnostic: throw ServiceError, return plain data.
 */

import {
  createDocument,
  type DocumentSelect,
  getDocument,
  type UpdateDocumentData,
  updateDocument,
} from '../lib/db/document-operations'
import type { DocumentTypeSelect } from '../lib/db/document-type-operations'
import {
  createBatch,
  createJob,
  updateJobStatus,
} from '../lib/db/job-operations'
import { processAndSaveDocument } from '../lib/processing'
import { triggerWebhookAsync } from '../lib/webhooks'
import {
  emitJobCompleted,
  emitJobFailed,
  emitJobStarted,
} from '../lib/websocket'
import { storage } from '../storage'
import { processBatchInBackground } from './batch'
import { ServiceError } from './errors'

export type UploadFile = { name: string; type: string; buffer: Buffer }

export type UploadResultItem = {
  filename: string
  success: boolean
  documentId?: string
  error?: string
}

export type UploadResult = {
  documentTypeId: string
  documentTypeSlug: string
  results: UploadResultItem[]
  jobIds?: string[]
  batchId?: string
  summary: { total: number; uploaded: number; failed: number }
}

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
]

const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
}

export async function uploadDocuments(
  docType: DocumentTypeSelect,
  files: UploadFile[],
  opts: { userId?: string; autoProcess?: boolean; model?: string },
): Promise<UploadResult> {
  const results: UploadResultItem[] = []

  for (const file of files) {
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const mimeType = file.type || EXT_TO_MIME[ext] || ''

      if (!ALLOWED_TYPES.includes(mimeType)) {
        results.push({
          filename: file.name,
          success: false,
          error: `Unsupported file type: ${mimeType || 'unknown'}`,
        })
        continue
      }

      const storageKey = await storage.upload(file.buffer, file.name, mimeType)

      const document = await createDocument({
        documentTypeId: docType.id,
        filename: file.name,
        storagePath: storageKey,
        createdBy: opts.userId,
      })

      triggerWebhookAsync(docType.id, document, 'document.uploaded')

      results.push({
        filename: file.name,
        success: true,
        documentId: document.id,
      })
    } catch (error) {
      console.error('Failed to upload file:', file.name, error)
      results.push({
        filename: file.name,
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      })
    }
  }

  const successful = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  const uploadedDocumentIds = results
    .filter((r) => r.success && r.documentId)
    .map((r) => r.documentId as string)

  let jobIds: string[] = []
  let batchId: string | undefined

  if (opts.autoProcess && uploadedDocumentIds.length > 0) {
    try {
      const { batch, jobs } = await createBatch({
        documentTypeId: docType.id,
        documentIds: uploadedDocumentIds,
        createdBy: opts.userId,
      })

      jobIds = jobs.map((j) => j.id)
      batchId = batch.id

      processBatchInBackground(
        batch.id,
        docType.id,
        uploadedDocumentIds,
        undefined,
        undefined,
        opts.model,
      )
    } catch (processError) {
      console.error('Failed to queue processing jobs:', processError)
    }
  }

  return {
    documentTypeId: docType.id,
    documentTypeSlug: docType.slug,
    results,
    ...(opts.autoProcess && jobIds.length > 0 ? { jobIds, batchId } : {}),
    summary: { total: files.length, uploaded: successful, failed },
  }
}

export async function updateDocumentWithWebhooks(
  doc: DocumentSelect,
  data: UpdateDocumentData,
): Promise<DocumentSelect | null> {
  const result = await updateDocument(doc.id, data)
  if (!result) return null

  if (data.status && data.status !== doc.status) {
    if (data.status === 'approved') {
      triggerWebhookAsync(doc.documentTypeId, result, 'document.approved')
    } else if (doc.status === 'approved') {
      triggerWebhookAsync(doc.documentTypeId, result, 'document.unapproved')
    }
  }

  return result
}

export async function startSingleDocumentProcessing(
  documentId: string,
  opts: { userId?: string; model?: string },
): Promise<{
  jobId: string
  done: Promise<{ extractedData: Record<string, unknown>; status?: string }>
}> {
  const doc = await getDocument(documentId)
  if (!doc) {
    throw new ServiceError('not_found', 'Document not found')
  }

  if (doc.status === 'processed' || doc.status === 'approved') {
    throw new ServiceError('conflict', 'Document already processed')
  }

  const job = await createJob({
    documentId,
    documentTypeId: doc.documentTypeId,
    createdBy: opts.userId,
  })

  await updateJobStatus(job.id, 'processing', { startedAt: new Date() })
  emitJobStarted(job.id, documentId, doc.documentTypeId)

  const done = (async () => {
    try {
      const { data, document } = await processAndSaveDocument(documentId, {
        overrideModel: opts.model,
      })

      await updateJobStatus(job.id, 'completed', { completedAt: new Date() })
      emitJobCompleted(job.id, documentId, doc.documentTypeId)

      return {
        extractedData: data as Record<string, unknown>,
        status: document?.status ?? undefined,
      }
    } catch (error) {
      console.error('Failed to process document:', error)
      const message =
        error instanceof Error ? error.message : 'Processing failed'

      await updateJobStatus(job.id, 'failed', {
        error: message,
        completedAt: new Date(),
      })
      emitJobFailed(job.id, documentId, doc.documentTypeId, message)

      throw error instanceof Error ? error : new Error(message)
    }
  })()
  // Avoid unhandled-rejection noise if the caller attaches late.
  done.catch(() => {})

  return { jobId: job.id, done }
}
