/**
 * Core database operations for documents
 * Context-free - can be called from API routes or background jobs
 */

import { db } from '../../db'
import { document, documentType } from '../../db/schema/app'
import { eq, desc, and, or, count, like } from 'drizzle-orm'
import type { DocumentSelect, DocumentInsert } from '../../db/schema/app'

export type { DocumentSelect, DocumentInsert }

export type DocumentStatus = 'pending' | 'processed' | 'approved' | 'rejected'

export interface GetDocumentsOptions {
  page?: number
  pageSize?: number
  status?: DocumentStatus | 'all' | string
  search?: string
}

export interface GetDocumentsResult {
  documents: DocumentSelect[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CreateDocumentData {
  documentTypeId: string
  filename: string
  storagePath: string
  createdBy?: string | null
}

export interface UpdateDocumentData {
  extractedData?: Record<string, unknown> | null
  schemaSnapshot?: Record<string, unknown> | null
  status?: DocumentStatus
  rejectionReason?: string | null
  slug?: string | null
  updatedBy?: string | null
}

/**
 * Get documents with pagination and filtering
 */
export async function getDocuments(
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
      conditions.push(eq(document.status, statuses[0] as DocumentStatus))
    } else if (statuses.length > 1) {
      conditions.push(
        or(...statuses.map((s) => eq(document.status, s as DocumentStatus)))!,
      )
    }
  }

  // Handle search filtering (search by filename or slug)
  if (search && search.trim()) {
    const searchPattern = `%${search.trim()}%`
    conditions.push(
      or(
        like(document.filename, searchPattern),
        like(document.slug, searchPattern)
      )!
    )
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
export async function getDocument(id: string): Promise<DocumentSelect | null> {
  const [result] = await db.select().from(document).where(eq(document.id, id))
  return result || null
}

/**
 * Check if a string is a valid UUID
 */
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

/**
 * Get a single document by slug or ID (slug first, falls back to ID)
 * This enables backwards compatibility for legacy documents without slugs
 */
export async function getDocumentBySlugOrId(slugOrId: string): Promise<DocumentSelect | null> {
  // Try slug first
  const [bySlug] = await db.select().from(document).where(eq(document.slug, slugOrId))
  if (bySlug) return bySlug

  // Fall back to ID lookup (only if it looks like a UUID)
  if (isUUID(slugOrId)) {
    const [byId] = await db.select().from(document).where(eq(document.id, slugOrId))
    return byId || null
  }

  return null
}

/**
 * Get a document with its document type
 */
export async function getDocumentWithType(id: string): Promise<{
  document: DocumentSelect
  documentType: typeof documentType.$inferSelect
} | null> {
  const [result] = await db
    .select()
    .from(document)
    .where(eq(document.id, id))

  if (!result) return null

  const [docType] = await db
    .select()
    .from(documentType)
    .where(eq(documentType.id, result.documentTypeId))

  if (!docType) return null

  return {
    document: result,
    documentType: docType,
  }
}

/**
 * Create a new document
 */
export async function createDocument(data: CreateDocumentData): Promise<DocumentSelect> {
  const [result] = await db
    .insert(document)
    .values({
      documentTypeId: data.documentTypeId,
      filename: data.filename,
      storagePath: data.storagePath,
      status: 'pending',
      createdBy: data.createdBy || null,
    })
    .returning()

  return result
}

/**
 * Update a document
 */
export async function updateDocument(
  id: string,
  data: UpdateDocumentData,
): Promise<DocumentSelect | null> {
  // Get current document to check previous status
  const [currentDoc] = await db.select().from(document).where(eq(document.id, id))
  if (!currentDoc) {
    return null
  }

  const updateData: Partial<DocumentInsert> & { updatedAt: Date } = {
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
  if (data.slug !== undefined) {
    updateData.slug = data.slug
  }
  if (data.updatedBy !== undefined) {
    updateData.updatedBy = data.updatedBy
  }

  const [result] = await db
    .update(document)
    .set(updateData)
    .where(eq(document.id, id))
    .returning()

  return result || null
}

/**
 * Bulk update document statuses
 */
export async function bulkUpdateDocumentStatus(
  documentIds: string[],
  status: DocumentStatus,
  updatedBy?: string | null,
): Promise<number> {
  if (documentIds.length === 0) return 0

  const result = await db
    .update(document)
    .set({
      status,
      updatedAt: new Date(),
      updatedBy: updatedBy || null,
    })
    .where(
      or(...documentIds.map((id) => eq(document.id, id)))!,
    )

  return documentIds.length
}

/**
 * Delete a document (file deletion must be handled separately)
 */
export async function deleteDocument(id: string): Promise<void> {
  await db.delete(document).where(eq(document.id, id))
}

/**
 * Bulk delete documents
 */
export async function bulkDeleteDocuments(documentIds: string[]): Promise<number> {
  if (documentIds.length === 0) return 0

  await db
    .delete(document)
    .where(or(...documentIds.map((id) => eq(document.id, id)))!)

  return documentIds.length
}

/**
 * Get all documents for a document type (for deletion)
 */
export async function getDocumentsByType(documentTypeId: string): Promise<DocumentSelect[]> {
  return db
    .select()
    .from(document)
    .where(eq(document.documentTypeId, documentTypeId))
}
