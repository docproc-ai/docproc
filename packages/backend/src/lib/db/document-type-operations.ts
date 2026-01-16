/**
 * Core database operations for document types
 * Context-free - can be called from API routes or background jobs
 */

import { db } from '../../db'
import { documentType, document } from '../../db/schema/app'
import { eq, desc, count } from 'drizzle-orm'
import { generateSlug } from '../generate-slug'
import {
  encryptWebhookConfig,
  createSafeWebhookConfig,
  mergeWebhookConfigs,
  decryptWebhookConfig,
  type DocumentWebhookConfig,
} from '../webhook-encryption'
import type { DocumentTypeSelect, DocumentTypeInsert } from '../../db/schema/app'

export type { DocumentTypeSelect, DocumentTypeInsert }

export interface CreateDocumentTypeData {
  name: string
  schema: Record<string, unknown>
  webhookConfig?: Record<string, unknown> | null
  validationInstructions?: string | null
  modelName?: string | null
  slugPattern?: string | null
  createdBy?: string | null
}

export interface UpdateDocumentTypeData {
  name?: string
  schema?: Record<string, unknown>
  webhookConfig?: Record<string, unknown> | null
  validationInstructions?: string | null
  modelName?: string | null
  slugPattern?: string | null
  updatedBy?: string | null
}

export interface DocumentTypeWithCount extends DocumentTypeSelect {
  documentCount: number
}

/**
 * Get all document types with document counts
 * Returns safe webhook config (sensitive values masked)
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

      // Return with safe webhook config (sensitive values masked)
      const safeWebhookConfig = type.webhookConfig
        ? createSafeWebhookConfig(type.webhookConfig as DocumentWebhookConfig)
        : null

      return {
        ...type,
        webhookConfig: safeWebhookConfig,
        documentCount: countResult?.count ?? 0,
      }
    }),
  )

  return typesWithCounts
}

/**
 * Get a single document type by ID
 * Returns safe webhook config (sensitive values masked) by default
 */
export async function getDocumentType(
  id: string,
  options?: { includeDecryptedWebhook?: boolean },
): Promise<DocumentTypeSelect | null> {
  const [result] = await db
    .select()
    .from(documentType)
    .where(eq(documentType.id, id))

  if (!result) return null

  // Return with appropriate webhook config
  if (options?.includeDecryptedWebhook) {
    // For internal use (webhook triggering) - decrypt sensitive values
    const decryptedConfig = result.webhookConfig
      ? decryptWebhookConfig(result.webhookConfig as DocumentWebhookConfig)
      : null
    return { ...result, webhookConfig: decryptedConfig }
  }

  // Default: return safe config for API responses
  const safeConfig = result.webhookConfig
    ? createSafeWebhookConfig(result.webhookConfig as DocumentWebhookConfig)
    : null
  return { ...result, webhookConfig: safeConfig }
}

/**
 * Get a document type by ID with raw (encrypted) webhook config
 * Used for merging during updates
 */
export async function getDocumentTypeRaw(id: string): Promise<DocumentTypeSelect | null> {
  const [result] = await db
    .select()
    .from(documentType)
    .where(eq(documentType.id, id))

  return result || null
}

/**
 * Get a document type by slug
 * Returns safe webhook config (sensitive values masked)
 */
export async function getDocumentTypeBySlug(slug: string): Promise<DocumentTypeSelect | null> {
  const [result] = await db
    .select()
    .from(documentType)
    .where(eq(documentType.slug, slug))

  if (!result) return null

  const safeConfig = result.webhookConfig
    ? createSafeWebhookConfig(result.webhookConfig as DocumentWebhookConfig)
    : null
  return { ...result, webhookConfig: safeConfig }
}

/**
 * Get a document type by slug or ID
 * Tries slug first, falls back to UUID if it looks like one
 * Returns safe webhook config (sensitive values masked)
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
 * Encrypts sensitive webhook header values before storing
 */
export async function createDocumentType(
  data: CreateDocumentTypeData,
): Promise<DocumentTypeSelect> {
  const slug = generateSlug(data.name)

  // Encrypt webhook config if provided
  const encryptedWebhookConfig = data.webhookConfig
    ? encryptWebhookConfig(data.webhookConfig as DocumentWebhookConfig)
    : null

  const [result] = await db
    .insert(documentType)
    .values({
      name: data.name,
      slug,
      schema: data.schema,
      webhookConfig: encryptedWebhookConfig,
      validationInstructions: data.validationInstructions || null,
      modelName: data.modelName || null,
      slugPattern: data.slugPattern || null,
      createdBy: data.createdBy || null,
    })
    .returning()

  // Return with safe config (masked sensitive values)
  const safeConfig = result.webhookConfig
    ? createSafeWebhookConfig(result.webhookConfig as DocumentWebhookConfig)
    : null
  return { ...result, webhookConfig: safeConfig }
}

/**
 * Update a document type
 * Merges webhook config to preserve encrypted values for unchanged sensitive headers
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

  // Handle webhook config merging
  if (data.webhookConfig !== undefined) {
    if (data.webhookConfig === null) {
      // Explicitly clearing webhook config
      updateData.webhookConfig = null
    } else {
      // Get existing encrypted config for merging
      const existing = await getDocumentTypeRaw(id)
      const existingConfig = existing?.webhookConfig as DocumentWebhookConfig | null

      // Merge: preserve existing encrypted values for unedited sensitive fields
      updateData.webhookConfig = mergeWebhookConfigs(
        existingConfig,
        data.webhookConfig as DocumentWebhookConfig,
      )
    }
  }

  if (data.validationInstructions !== undefined) {
    updateData.validationInstructions = data.validationInstructions
  }
  if (data.modelName !== undefined) updateData.modelName = data.modelName
  if (data.slugPattern !== undefined) updateData.slugPattern = data.slugPattern
  if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy

  const [result] = await db
    .update(documentType)
    .set(updateData)
    .where(eq(documentType.id, id))
    .returning()

  if (!result) return null

  // Return with safe config (masked sensitive values)
  const safeConfig = result.webhookConfig
    ? createSafeWebhookConfig(result.webhookConfig as DocumentWebhookConfig)
    : null
  return { ...result, webhookConfig: safeConfig }
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
