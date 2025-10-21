'use server'

import { streamObject } from 'ai'
import { checkDocumentPermissions } from '../auth-utils'
import { processAndSaveDocument } from '@/lib/document-processing/processor'
import {
  getSystemPrompt,
  getModelAndProviderForProcessing,
  buildMessageContent,
  loadDocumentFile,
  prepareSchemaForAI,
} from '@/lib/document-processing/shared'
import { getDocument, getDocumentType } from '@/lib/actions/document-type'

export async function processDocument(formData: FormData) {
  const documentId = formData.get('documentId') as string
  const documentTypeId = formData.get('documentTypeId') as string
  const schemaString = formData.get('schema') as string
  let overrideModel = formData.get('model') as string

  if (!documentId || !documentTypeId || !schemaString) {
    throw new Error('Document ID, document type ID, and schema are required')
  }

  // Validate admin privileges for model override
  if (overrideModel) {
    const permissionCheck = await checkDocumentPermissions(['update'])
    if (!permissionCheck.success) {
      // Non-admin users cannot override models - ignore the parameter
      overrideModel = ''
      console.warn(
        'Non-admin user attempted to override model in processDocument, ignoring parameter',
      )
    }
  }

  let schema
  try {
    schema = JSON.parse(schemaString)
  } catch {
    throw new Error('Invalid schema JSON')
  }

  return await processAndSaveDocument(documentId, documentTypeId, schema, {
    overrideModel: overrideModel || undefined,
  })
}

export async function processDocumentStream(formData: FormData) {
  const documentId = formData.get('documentId') as string
  const documentTypeId = formData.get('documentTypeId') as string
  const schemaString = formData.get('schema') as string
  let overrideModel = formData.get('model') as string

  if (!documentId || !documentTypeId || !schemaString) {
    throw new Error('Document ID, document type ID, and schema are required')
  }

  // Validate admin privileges for model override
  if (overrideModel) {
    const permissionCheck = await checkDocumentPermissions(['update'])
    if (!permissionCheck.success) {
      // Non-admin users cannot override models - ignore the parameter
      overrideModel = ''
      console.warn(
        'Non-admin user attempted to override model in processDocumentStream, ignoring parameter',
      )
    }
  }

  let schema
  try {
    schema = JSON.parse(schemaString)
  } catch {
    throw new Error('Invalid schema JSON')
  }

  try {
    // Get the model and provider to use
    const { provider, modelName } = await getModelAndProviderForProcessing(
      documentTypeId,
      overrideModel || undefined,
    )

    // Get the document type for validation
    const docType = await getDocumentType(documentTypeId)
    if (!docType) {
      throw new Error('Document type not found')
    }

    // Get the document
    const { getDocument: getDoc } = await import('./document')
    const doc = await getDoc(documentId)
    if (!doc) {
      throw new Error('Document not found')
    }

    // Load document file from storage
    const fileBuffer = await loadDocumentFile(doc.storagePath)

    // Validate document (uses shared validation logic)
    const { validateDocument } = await import('@/lib/document-processing/processor')
    const validation = await validateDocument(docType, fileBuffer, doc.filename, provider, modelName)

    if (!validation.isValid) {
      // Save rejection to database
      const { updateDocument: updateDoc } = await import('./document')
      const rejectionFormData = new FormData()
      rejectionFormData.append('status', 'rejected')
      rejectionFormData.append(
        'rejectionReason',
        validation.reason || 'Document does not match expected type',
      )
      await updateDoc(documentId, rejectionFormData)

      throw new Error(
        `Document validation failed: ${validation.reason || 'Document does not match expected type'}`,
      )
    }

    // Prepare schema for AI
    const schemaForAI = prepareSchemaForAI(schema)

    // Build message content
    const messageContent = buildMessageContent(fileBuffer, doc.filename, schema, false)
    const messages = [
      {
        role: 'user' as const,
        content: messageContent,
      },
    ]

    // Stream object generation
    const { partialObjectStream } = await streamObject({
      model: provider.getModel(modelName),
      schema: schemaForAI,
      system: getSystemPrompt(),
      messages,
    })

    return partialObjectStream
  } catch (error) {
    // Only log actual processing errors, not validation rejections
    if (error instanceof Error && !error.message.includes('Document validation failed')) {
      console.error('Failed to process document stream:', error)
    }
    throw error
  }
}
