/**
 * Core database operations for document types
 * Context-free - can be called from API routes or background jobs
 */

import { db } from '../../../db'
import { documentType, document } from '../../../db/schema/app'
import { eq, desc, count } from 'drizzle-orm'
import { generateSlug } from '../generate-slug'
import type { DocumentTypeSelect, DocumentTypeInsert } from '../../../db/schema/app'

export type { DocumentTypeSelect, DocumentTypeInsert }

export interface CreateDocumentTypeData {
  name: string
  schema: Record<string, unknown>
  webhookConfig?: Record<string, unknown> | null
  validationInstructions?: string | null
  modelName?: string | null
  createdBy?: string | null
}

export interface UpdateDocumentTypeData {
  name?: string
  schema?: Record<string, unknown>
  webhookConfig?: Record<string, unknown> | null
  validationInstructions?: string | null
  modelName?: string | null
  updatedBy?: string | null
}

export interface DocumentTypeWithCount extends DocumentTypeSelect {
  documentCount: number
}

/**
 * Get all document types with document counts
 */
export async function getDocumentTypes(): Promise<DocumentTypeWithCount[]> {
  const documentTypes = await db
    .select()
    .from(documentType)
    .orderBy(desc(documentType.createdAt))

  const typesWithCounts = await Promise.all(
    documentTypes.map(async (type) => {
      const [countResult] = await db
        .select({ count: count() })
        .from(document)
        .where(eq(document.documentTypeId, type.id))

      return {
        ...type,
        documentCount: countResult?.count ?? 0,
      }
    }),
  )

  return typesWithCounts
}

/**
 * Get a single document type by ID
 */
export async function getDocumentType(id: string): Promise<DocumentTypeSelect | null> {
  const [result] = await db
    .select()
    .from(documentType)
    .where(eq(documentType.id, id))

  return result || null
}

/**
 * Get a document type by slug
 */
export async function getDocumentTypeBySlug(slug: string): Promise<DocumentTypeSelect | null> {
  const [result] = await db
    .select()
    .from(documentType)
    .where(eq(documentType.slug, slug))

  return result || null
}

/**
 * Get a document type by slug or ID
 * Tries slug first, falls back to UUID if it looks like one
 */
export async function getDocumentTypeBySlugOrId(
  slugOrId: string,
): Promise<DocumentTypeSelect | null> {
  // UUID v4 pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  // If it looks like a UUID, try by ID first
  if (uuidPattern.test(slugOrId)) {
    const byId = await getDocumentType(slugOrId)
    if (byId) return byId
  }

  // Otherwise try by slug
  return getDocumentTypeBySlug(slugOrId)
}

/**
 * Create a new document type
 */
export async function createDocumentType(
  data: CreateDocumentTypeData,
): Promise<DocumentTypeSelect> {
  const slug = generateSlug(data.name)

  const [result] = await db
    .insert(documentType)
    .values({
      name: data.name,
      slug,
      schema: data.schema,
      webhookConfig: data.webhookConfig || null,
      validationInstructions: data.validationInstructions || null,
      modelName: data.modelName || null,
      createdBy: data.createdBy || null,
    })
    .returning()

  return result
}

/**
 * Update a document type
 */
export async function updateDocumentType(
  id: string,
  data: UpdateDocumentTypeData,
): Promise<DocumentTypeSelect | null> {
  const updateData: Partial<DocumentTypeInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  }

  if (data.name !== undefined) updateData.name = data.name
  if (data.schema !== undefined) updateData.schema = data.schema
  if (data.webhookConfig !== undefined) updateData.webhookConfig = data.webhookConfig
  if (data.validationInstructions !== undefined) {
    updateData.validationInstructions = data.validationInstructions
  }
  if (data.modelName !== undefined) updateData.modelName = data.modelName
  if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy

  const [result] = await db
    .update(documentType)
    .set(updateData)
    .where(eq(documentType.id, id))
    .returning()

  return result || null
}

/**
 * Delete a document type and all its documents
 * Note: Files must be deleted separately via storage
 */
export async function deleteDocumentType(id: string): Promise<void> {
  // First delete all documents of this type
  // Note: This doesn't delete the actual files - that must be handled separately
  await db.delete(document).where(eq(document.documentTypeId, id))

  // Then delete the document type
  await db.delete(documentType).where(eq(documentType.id, id))
}
