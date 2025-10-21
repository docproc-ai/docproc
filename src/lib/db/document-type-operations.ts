/**
 * Core database operations for document types
 * Context-free - can be called from API routes, Server Actions, or background jobs
 */

import { db } from '@/db'
import { documentType, document } from '@/db/schema'
import { eq, desc, count } from 'drizzle-orm'
import { generateSlug } from '@/lib/generate-slug'
import {
  encryptWebhookConfig,
  decryptWebhookConfig,
  createSafeWebhookConfig,
  mergeWebhookConfigs,
  type DocumentWebhookConfig,
} from '@/lib/webhook-encryption'
import type { InferSelectModel } from 'drizzle-orm'

export type DocumentType = InferSelectModel<typeof documentType>

export interface CreateDocumentTypeData {
  name: string
  schema: Record<string, any>
  webhookConfig?: DocumentWebhookConfig | null
  validationInstructions?: string | null
  providerName?: string | null
  modelName?: string | null
}

export interface UpdateDocumentTypeData {
  name?: string
  schema?: Record<string, any>
  webhookConfig?: DocumentWebhookConfig | null
  validationInstructions?: string | null
  providerName?: string | null
  modelName?: string | null
}

/**
 * Get all document types with document counts
 */
export async function getDocumentTypesCore(): Promise<
  (DocumentType & { document_count: number })[]
> {
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
        document_count: countResult.count,
      }
    }),
  )

  return typesWithCounts
}

/**
 * Get a single document type by ID
 * Returns safe webhook config with placeholders for sensitive values
 */
export async function getDocumentTypeCore(
  id: string,
  options?: { includeSensitive?: boolean },
): Promise<DocumentType | null> {
  const [result] = await db.select().from(documentType).where(eq(documentType.id, id))
  if (!result) return null

  // Create safe webhook config with placeholders for sensitive values (unless explicitly requested)
  if (result.webhookConfig && !options?.includeSensitive) {
    try {
      const decryptedConfig = decryptWebhookConfig(
        result.webhookConfig as DocumentWebhookConfig,
      )
      const safeConfig = createSafeWebhookConfig(decryptedConfig)
      return {
        ...result,
        webhookConfig: safeConfig,
      }
    } catch (error) {
      console.error('Failed to process webhook config:', error)
      return {
        ...result,
        webhookConfig: null,
      }
    }
  }

  return result
}

/**
 * Create a new document type
 */
export async function createDocumentTypeCore(
  data: CreateDocumentTypeData,
): Promise<DocumentType> {
  const slug = generateSlug(data.name)

  const [result] = await db
    .insert(documentType)
    .values({
      name: data.name,
      slug,
      schema: data.schema,
      webhookConfig: data.webhookConfig || null,
      validationInstructions: data.validationInstructions || null,
      providerName: data.providerName || null,
      modelName: data.modelName || null,
    })
    .returning()

  return result
}

/**
 * Update a document type
 */
export async function updateDocumentTypeCore(
  id: string,
  data: UpdateDocumentTypeData,
): Promise<DocumentType | null> {
  const updateData: any = {
    updatedAt: new Date(),
  }

  if (data.name !== undefined) updateData.name = data.name
  if (data.schema !== undefined) updateData.schema = data.schema
  if (data.webhookConfig !== undefined) updateData.webhookConfig = data.webhookConfig
  if (data.validationInstructions !== undefined)
    updateData.validationInstructions = data.validationInstructions
  if (data.providerName !== undefined) updateData.providerName = data.providerName
  if (data.modelName !== undefined) updateData.modelName = data.modelName

  const [result] = await db
    .update(documentType)
    .set(updateData)
    .where(eq(documentType.id, id))
    .returning()

  return result || null
}

/**
 * Delete a document type and all its documents
 */
export async function deleteDocumentTypeCore(id: string): Promise<void> {
  // First delete all documents of this type
  await db.delete(document).where(eq(document.documentTypeId, id))

  // Then delete the document type
  await db.delete(documentType).where(eq(documentType.id, id))
}
