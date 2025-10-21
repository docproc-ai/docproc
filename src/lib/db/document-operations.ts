/**
 * Core database operations for documents
 * These functions are context-free and can be called from anywhere (API routes, Server Actions, background jobs)
 * DO NOT import Next.js-specific APIs (headers, revalidatePath, etc.) in this file
 */

import { db } from '@/db'
import { document, documentType } from '@/db/schema'
import { eq, desc, and, or, count, like } from 'drizzle-orm'
import { triggerWebhook, type DocumentWebhookEventName } from '@/lib/webhooks'
import type { InferSelectModel } from 'drizzle-orm'

export type Document = InferSelectModel<typeof document>

export interface GetDocumentsOptions {
  page?: number
  pageSize?: number
  status?: 'pending' | 'processed' | 'approved' | 'rejected' | 'all' | string
  search?: string
}

export interface GetDocumentsResult {
  documents: Document[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CreateDocumentData {
  documentTypeId: string
  filename: string
  storagePath: string
}

export interface UpdateDocumentData {
  extractedData?: Record<string, any>
  schemaSnapshot?: Record<string, any>
  status?: 'pending' | 'processed' | 'approved' | 'rejected'
  rejectionReason?: string | null
}

/**
 * Core function to update a document in the database
 * This is context-free and can be called from Server Actions or background workers
 */
export async function updateDocumentCore(
  id: string,
  data: UpdateDocumentData,
): Promise<typeof document.$inferSelect> {
  // Get current document to check previous status
  const [currentDoc] = await db.select().from(document).where(eq(document.id, id))
  if (!currentDoc) {
    throw new Error('Document not found')
  }

  const updateData: any = {
    updatedAt: new Date(),
  }

  if (data.extractedData !== undefined) {
    updateData.extractedData = data.extractedData
  }

  if (data.schemaSnapshot !== undefined) {
    updateData.schemaSnapshot = data.schemaSnapshot
  }

  if (data.status !== undefined) {
    updateData.status = data.status
  }

  if (data.rejectionReason !== undefined) {
    updateData.rejectionReason = data.rejectionReason
  }

  const [result] = await db
    .update(document)
    .set(updateData)
    .where(eq(document.id, id))
    .returning()

  if (!result) {
    throw new Error('Document not found')
  }

  // Get document type for webhook
  const [docType] = await db
    .select()
    .from(documentType)
    .where(eq(documentType.id, result.documentTypeId))

  // Trigger appropriate webhook based on status change
  if (data.status && data.status !== currentDoc.status && docType) {
    let webhookEvent: DocumentWebhookEventName | null = null

    // Check for unapproval first (leaving approved status)
    if (currentDoc.status === 'approved' && (data.status === 'pending' || data.status === 'processed')) {
      webhookEvent = 'document.unapproved'
    } else if (data.status === 'processed') {
      webhookEvent = 'document.processed'
    } else if (data.status === 'approved') {
      webhookEvent = 'document.approved'
    }

    if (webhookEvent) {
      try {
        await triggerWebhook(docType, result, webhookEvent)
      } catch (webhookError) {
        console.error('Webhook failed:', webhookError)
        // Don't fail the update if webhook fails
      }
    }
  }

  return result
}

/**
 * Get documents with pagination and filtering
 */
export async function getDocumentsCore(
  documentTypeId: string,
  options: GetDocumentsOptions = {},
): Promise<GetDocumentsResult> {
  const { page = 1, pageSize = 50, status = 'all', search } = options

  // Build where conditions
  const conditions = [eq(document.documentTypeId, documentTypeId)]

  // Handle status filtering
  if (status && status !== 'all') {
    const statuses = status.includes(',') ? status.split(',') : [status]

    if (statuses.length === 1) {
      conditions.push(eq(document.status, statuses[0] as any))
    } else if (statuses.length > 1) {
      conditions.push(or(...statuses.map((s) => eq(document.status, s as any)))!)
    }
  }

  // Handle search filtering
  if (search && search.trim()) {
    conditions.push(like(document.filename, `%${search.trim()}%`))
  }

  // Get total count for pagination
  const countResult = await db
    .select({ count: count() })
    .from(document)
    .where(and(...conditions))

  const total = Number(countResult[0]?.count || 0)
  const totalPages = Math.ceil(total / pageSize)

  // Get paginated documents
  const documents = await db
    .select()
    .from(document)
    .where(and(...conditions))
    .orderBy(desc(document.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    documents,
    total,
    page,
    pageSize,
    totalPages,
  }
}

/**
 * Get a single document by ID
 */
export async function getDocumentCore(id: string): Promise<Document | null> {
  const [result] = await db.select().from(document).where(eq(document.id, id))
  return result || null
}

/**
 * Create a new document
 */
export async function createDocumentCore(data: CreateDocumentData): Promise<Document> {
  const [result] = await db
    .insert(document)
    .values({
      documentTypeId: data.documentTypeId,
      filename: data.filename,
      storagePath: data.storagePath,
      status: 'pending',
    })
    .returning()

  return result
}

/**
 * Bulk update document statuses
 */
export async function bulkUpdateDocumentStatusCore(
  documentIds: string[],
  status: 'pending' | 'processed' | 'approved' | 'rejected',
): Promise<void> {
  for (const id of documentIds) {
    await updateDocumentCore(id, { status })
  }
}

/**
 * Delete a document (file deletion must be handled separately)
 */
export async function deleteDocumentCore(id: string): Promise<void> {
  await db.delete(document).where(eq(document.id, id))
}
