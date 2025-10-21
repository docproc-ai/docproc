'use server'

import { db } from '@/db'
import { documentType, document } from '@/db/schema'
import { eq, desc, count } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { generateSlug } from '@/lib/generate-slug'
import { checkDocumentTypePermissions } from '@/lib/auth-utils'
import { encryptWebhookConfig, decryptWebhookConfig, createSafeWebhookConfig, mergeWebhookConfigs, type DocumentWebhookConfig } from '@/lib/webhook-encryption'
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '../auth'

export type DocumentType = InferSelectModel<typeof documentType>
export type NewDocumentType = InferInsertModel<typeof documentType>

export async function getDocumentTypes(): Promise<(DocumentType & { document_count: number })[]> {
  // Check document type list permissions
  const permissionCheck = await checkDocumentTypePermissions(['list'])
  if (!permissionCheck.success) {
    console.error('Permission denied for listing document types:', permissionCheck.error)
    return []
  }

  try {
    const { getDocumentTypesCore } = await import('@/lib/db/document-type-operations')
    return await getDocumentTypesCore()
  } catch (error) {
    console.error('Failed to get document types:', error)
    return []
  }
}

export async function getDocumentType(id: string): Promise<DocumentType | null> {
  try {
    const { getDocumentTypeCore } = await import('@/lib/db/document-type-operations')
    return await getDocumentTypeCore(id)
  } catch (error) {
    console.error('Failed to get document type:', error)
    return null
  }
}

export async function createDocumentType(formData: FormData) {
  // Check document type creation permissions
  const permissionCheck = await checkDocumentTypePermissions(['create'])
  if (!permissionCheck.success) {
    return permissionCheck
  }

  try {
    const name = formData.get('name') as string
    const schemaString = formData.get('schema') as string
    const webhookConfigString = formData.get('webhookConfig') as string
    const validationInstructions = formData.get('validationInstructions') as string
    const providerName = formData.get('providerName') as string
    const modelName = formData.get('modelName') as string

    // Legacy support for old webhook fields
    const webhookUrl = formData.get('webhookUrl') as string
    const webhookMethod = formData.get('webhookMethod') as string

    if (!name || !schemaString) {
      return { success: false, error: 'Name and schema are required' }
    }

    let schema
    try {
      schema = JSON.parse(schemaString)
    } catch {
      return { success: false, error: 'Invalid JSON schema' }
    }

    let webhookConfig: DocumentWebhookConfig | null = null

    // Handle new webhook config format
    if (webhookConfigString) {
      try {
        const parsedConfig = JSON.parse(webhookConfigString)
        // Encrypt sensitive data before storing
        webhookConfig = encryptWebhookConfig(parsedConfig)
      } catch {
        return { success: false, error: 'Invalid webhook configuration' }
      }
    }
    // Legacy support: convert old webhook fields to new format
    else if (webhookUrl) {
      const legacyConfig: DocumentWebhookConfig = {
        events: {
          'document.approved': {
            enabled: true,
            url: webhookUrl,
            method: webhookMethod || 'POST',
            headers: []
          }
        }
      }
      webhookConfig = encryptWebhookConfig(legacyConfig)
    }

    const { createDocumentTypeCore } = await import('@/lib/db/document-type-operations')
    const result = await createDocumentTypeCore({
      name,
      schema,
      webhookConfig,
      validationInstructions: validationInstructions || null,
      providerName: providerName || null,
      modelName: modelName || null,
    })

    revalidatePath('/document-types')
    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to create document type:', error)
    return { success: false, error: 'Failed to create document type' }
  }
}

export async function updateDocumentType(id: string, formData: FormData) {
  // Check document type update permissions
  const permissionCheck = await checkDocumentTypePermissions(['update'])
  if (!permissionCheck.success) {
    return permissionCheck
  }

  try {
    const name = formData.get('name') as string
    const schemaString = formData.get('schema') as string
    const webhookConfigString = formData.get('webhookConfig') as string
    const validationInstructions = formData.get('validationInstructions') as string
    const providerName = formData.get('providerName') as string
    const modelName = formData.get('modelName') as string

    // Legacy support for old webhook fields
    const webhookUrl = formData.get('webhookUrl') as string
    const webhookMethod = formData.get('webhookMethod') as string

    if (!name || !schemaString) {
      return { success: false, error: 'Name and schema are required' }
    }

    let schema
    try {
      schema = JSON.parse(schemaString)
    } catch {
      return { success: false, error: 'Invalid JSON schema' }
    }

    let webhookConfig: DocumentWebhookConfig | null = null

    // Handle new webhook config format
    if (webhookConfigString) {
      try {
        const parsedConfig = JSON.parse(webhookConfigString)

        // Get existing config to merge with updated values
        const existing = await db.select().from(documentType).where(eq(documentType.id, id))
        const existingConfig = existing[0]?.webhookConfig as DocumentWebhookConfig | null

        // Merge configs to preserve unedited encrypted values
        webhookConfig = mergeWebhookConfigs(existingConfig || { events: {} }, parsedConfig)
      } catch {
        return { success: false, error: 'Invalid webhook configuration' }
      }
    }
    // Legacy support: convert old webhook fields to new format
    else if (webhookUrl) {
      const legacyConfig: DocumentWebhookConfig = {
        events: {
          'document.approved': {
            enabled: true,
            url: webhookUrl,
            method: webhookMethod || 'POST',
            headers: []
          }
        }
      }
      webhookConfig = encryptWebhookConfig(legacyConfig)
    }

    const { updateDocumentTypeCore } = await import('@/lib/db/document-type-operations')
    const result = await updateDocumentTypeCore(id, {
      name,
      schema,
      webhookConfig,
      validationInstructions: validationInstructions || null,
      providerName: providerName || null,
      modelName: modelName || null,
    })

    if (!result) {
      return { success: false, error: 'Document type not found' }
    }

    revalidatePath('/document-types')
    revalidatePath(`/document-types/edit/${id}`)
    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to update document type:', error)
    return { success: false, error: 'Failed to update document type' }
  }
}

export async function deleteDocumentType(id: string) {
  // Check document type delete permissions
  const permissionCheck = await checkDocumentTypePermissions(['delete'])
  if (!permissionCheck.success) {
    throw new Error(permissionCheck.error)
  }

  try {
    const { deleteDocumentTypeCore } = await import('@/lib/db/document-type-operations')
    await deleteDocumentTypeCore(id)

    revalidatePath('/document-types')
  } catch (error) {
    console.error('Failed to delete document type:', error)
    throw error
  }
}
