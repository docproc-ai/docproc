import { generateObject, generateText, streamObject, streamText, jsonSchema } from 'ai'
import { getDocument, updateDocument } from '@/lib/actions/document'
import { getDocumentType } from '@/lib/actions/document-type'
import { jsonrepair } from 'jsonrepair'
import {
  getSystemPrompt,
  getMimeType,
  getModelAndProviderForProcessing,
  buildMessageContent,
  loadDocumentFile,
  prepareSchemaForAI,
  type ValidationResult,
  type ProcessingOptions,
} from './shared'

/**
 * Validate if a document matches the expected document type
 * Returns early if validation instructions are not set
 */
export async function validateDocument(
  docType: any,
  fileBuffer: Buffer,
  filename: string,
  provider: any,
  modelName: string,
): Promise<ValidationResult> {
  // Skip validation if no instructions provided
  if (!docType.validationInstructions || !docType.validationInstructions.trim()) {
    return { isValid: true }
  }

  // Determine file type from filename
  const fileExtension = filename.toLowerCase().split('.').pop()
  const mimeType = getMimeType(fileExtension || '')

  // Build the message content
  const messageContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; image: Buffer }
    | { type: 'file'; data: Buffer; mediaType: string; filename?: string }
  > = [
    {
      type: 'text',
      text: `Validate if this document matches the expected type.

${docType.validationInstructions}

Respond with your assessment.`,
    },
  ]

  if (mimeType.startsWith('image/')) {
    messageContent.push({ type: 'image', image: fileBuffer })
  } else {
    messageContent.push({
      type: 'file',
      data: fileBuffer,
      mediaType: mimeType,
      filename: filename,
    })
  }

  const messages = [
    {
      role: 'user' as const,
      content: messageContent,
    },
  ]

  // Define validation response schema
  const validationSchema = jsonSchema<ValidationResult>({
    type: 'object',
    properties: {
      isValid: {
        type: 'boolean',
        description: 'Whether the document matches the expected type',
      },
      reason: {
        type: 'string',
        description: 'Explanation of why the document is valid or invalid',
      },
    },
    required: ['isValid'],
  })

  try {
    const { object } = await generateObject({
      model: provider.getModel(modelName),
      schema: validationSchema,
      messages,
    })

    return object
  } catch (error) {
    console.error('Validation failed:', error)
    // On validation error, allow processing to continue
    return { isValid: true, reason: 'Validation check failed, proceeding with processing' }
  }
}

/**
 * Process a single document using structured object generation
 * Returns the extracted data object
 */
export async function processDocumentStructured(
  documentId: string,
  documentTypeId: string,
  schema: any,
  options: ProcessingOptions = {},
): Promise<{ data: any; validation?: ValidationResult }> {
  const { skipValidation = false, overrideModel } = options

  // Get the model and provider to use
  const { provider, modelName } = await getModelAndProviderForProcessing(
    documentTypeId,
    overrideModel,
  )

  // Get the document type for validation instructions
  const docType = await getDocumentType(documentTypeId)
  if (!docType) {
    throw new Error('Document type not found')
  }

  // Get the document
  const doc = await getDocument(documentId)
  if (!doc) {
    throw new Error('Document not found')
  }

  // Load document file from storage
  const fileBuffer = await loadDocumentFile(doc.storagePath)

  // Validate document type if validation instructions exist (unless explicitly skipped)
  let validation: ValidationResult | undefined
  if (!skipValidation) {
    validation = await validateDocument(docType, fileBuffer, doc.filename, provider, modelName)

    if (!validation.isValid) {
      // Save rejection to database
      const rejectionFormData = new FormData()
      rejectionFormData.append('status', 'rejected')
      rejectionFormData.append(
        'rejectionReason',
        validation.reason || 'Document does not match expected type',
      )
      await updateDocument(documentId, rejectionFormData)

      throw new Error(
        `Document validation failed: ${validation.reason || 'Document does not match expected type'}`,
      )
    }
  }

  // Prepare the schema for AI SDK
  const schemaForAI = prepareSchemaForAI(schema)

  // Build message content
  const messageContent = buildMessageContent(fileBuffer, doc.filename, schema, false)
  const messages = [
    {
      role: 'user' as const,
      content: messageContent,
    },
  ]

  // Generate structured object
  const { object } = await generateObject({
    model: provider.getModel(modelName),
    schema: schemaForAI,
    system: getSystemPrompt(),
    messages,
  })

  return { data: object, validation }
}

/**
 * Process a single document using text generation (for non-streaming batch)
 * Returns the extracted data by parsing JSON from text response
 */
export async function processDocumentText(
  documentId: string,
  documentTypeId: string,
  schema: any,
  options: ProcessingOptions = {},
): Promise<{ data: any; validation?: ValidationResult }> {
  const { skipValidation = false, overrideModel } = options

  // Get the model and provider to use
  const { provider, modelName } = await getModelAndProviderForProcessing(
    documentTypeId,
    overrideModel,
  )

  // Get the document type for validation
  const docType = await getDocumentType(documentTypeId)
  if (!docType) {
    throw new Error('Document type not found')
  }

  // Get the document
  const doc = await getDocument(documentId)
  if (!doc) {
    throw new Error('Document not found')
  }

  // Load document file from storage
  const fileBuffer = await loadDocumentFile(doc.storagePath)

  // Validate document type if validation instructions exist (unless explicitly skipped)
  let validation: ValidationResult | undefined
  if (!skipValidation) {
    validation = await validateDocument(docType, fileBuffer, doc.filename, provider, modelName)

    if (!validation.isValid) {
      // Save rejection to database
      const rejectionFormData = new FormData()
      rejectionFormData.append('status', 'rejected')
      rejectionFormData.append(
        'rejectionReason',
        validation.reason || 'Document does not match expected type',
      )
      await updateDocument(documentId, rejectionFormData)

      throw new Error(
        `Document validation failed: ${validation.reason || 'Document does not match expected type'}`,
      )
    }
  }

  // Build message content with schema in text
  const messageContent = buildMessageContent(fileBuffer, doc.filename, schema, true)
  const messages = [
    {
      role: 'user' as const,
      content: messageContent,
    },
  ]

  // Generate text response
  const { text } = await generateText({
    model: provider.getModel(modelName),
    system: getSystemPrompt(),
    messages,
  })

  // Parse the JSON response using jsonrepair
  let extractedData
  try {
    const repairedJson = jsonrepair(text.trim())
    extractedData = JSON.parse(repairedJson)
  } catch (parseError) {
    console.error('❌ Failed to parse JSON response for document:', documentId, parseError)
    console.error('Raw response text:', text)
    throw new Error('Model returned text instead of JSON')
  }

  return { data: extractedData, validation }
}

/**
 * Process a single document and save to database
 * This is the main entry point for processing a document
 */
/**
 * Process document with streaming progress updates (for BullMQ workers)
 * Emits partial results via progress callback as AI streams data
 */
export async function processDocumentWithProgress(
  documentId: string,
  documentTypeId: string,
  schema: any,
  options: ProcessingOptions & { onProgress?: (partialData: any) => void } = {},
): Promise<{ data: any; document: any; validation?: ValidationResult }> {
  const { skipValidation = false, overrideModel, onProgress } = options

  // Get the model and provider to use
  const { provider, modelName } = await getModelAndProviderForProcessing(
    documentTypeId,
    overrideModel,
  )

  // Get the document type for validation instructions
  const docType = await getDocumentType(documentTypeId)
  if (!docType) {
    throw new Error('Document type not found')
  }

  // Get the document
  const doc = await getDocument(documentId)
  if (!doc) {
    throw new Error('Document not found')
  }

  // Load document file from storage
  const fileBuffer = await loadDocumentFile(doc.storagePath)

  // Validate document type if validation instructions exist (unless explicitly skipped)
  let validation: ValidationResult | undefined
  if (!skipValidation) {
    validation = await validateDocument(docType, fileBuffer, doc.filename, provider, modelName)

    if (!validation.isValid) {
      // Save rejection to database
      const rejectionFormData = new FormData()
      rejectionFormData.append('status', 'rejected')
      rejectionFormData.append(
        'rejectionReason',
        validation.reason || 'Document does not match expected type',
      )
      await updateDocument(documentId, rejectionFormData)

      throw new Error(
        `Document validation failed: ${validation.reason || 'Document does not match expected type'}`,
      )
    }
  }

  // Prepare the schema for AI SDK
  const schemaForAI = prepareSchemaForAI(schema)

  // Build message content
  const messageContent = buildMessageContent(fileBuffer, doc.filename, schema, false)
  const messages = [
    {
      role: 'user' as const,
      content: messageContent,
    },
  ]

  // Use streamObject to get progressive updates
  const { partialObjectStream } = await streamObject({
    model: provider.getModel(modelName),
    schema: schemaForAI,
    system: getSystemPrompt(),
    messages,
  })

  // Stream partial results
  let finalData: any = {}
  for await (const partialObject of partialObjectStream) {
    finalData = partialObject
    // Emit progress with partial data
    if (onProgress) {
      onProgress(partialObject)
    }
  }

  // Update document with extracted data
  const { updateDocumentCore } = await import('@/lib/db/document-operations')
  const updatedDoc = await updateDocumentCore(documentId, {
    extractedData: finalData,
    status: 'processed',
    schemaSnapshot: schema,
  })

  return { data: finalData, document: updatedDoc, validation }
}

export async function processAndSaveDocument(
  documentId: string,
  documentTypeId: string,
  schema: any,
  options: ProcessingOptions = {},
): Promise<{ data: any; document: any; validation?: ValidationResult }> {
  try {
    // Use structured object generation by default (more reliable)
    const { data, validation } = await processDocumentStructured(
      documentId,
      documentTypeId,
      schema,
      options,
    )

    // Update document with extracted data
    // Use core database function (works in any context - API routes, Server Actions, background jobs)
    const { updateDocumentCore } = await import('@/lib/db/document-operations')
    const updatedDoc = await updateDocumentCore(documentId, {
      extractedData: data,
      status: 'processed',
      schemaSnapshot: schema,
    })

    return { data, document: updatedDoc, validation }
  } catch (error) {
    // Only log actual processing errors, not validation rejections
    if (error instanceof Error && !error.message.includes('Document validation failed')) {
      console.error('Failed to process document:', error)
    }
    throw error
  }
}

/**
 * Process multiple documents with controlled concurrency
 * @param documentIds - Array of document IDs to process
 * @param documentTypeId - Document type ID
 * @param schema - Schema for extraction
 * @param options - Processing options
 * @param concurrency - Maximum number of concurrent processing operations (default: 5)
 * @param onProgress - Callback for progress updates
 */
export async function processDocumentBatch(
  documentIds: string[],
  documentTypeId: string,
  schema: any,
  options: ProcessingOptions = {},
  concurrency: number = 5,
  onProgress?: (completed: number, total: number, docId: string, error?: Error) => void,
): Promise<{
  completed: string[]
  failed: Array<{ documentId: string; error: string }>
}> {
  const results = {
    completed: [] as string[],
    failed: [] as Array<{ documentId: string; error: string }>,
  }

  // Process documents with concurrency control
  let completedCount = 0
  const processing = new Set<Promise<void>>()

  for (const documentId of documentIds) {
    // Wait if we've hit the concurrency limit
    if (processing.size >= concurrency) {
      await Promise.race(processing)
    }

    const promise = (async () => {
      try {
        await processAndSaveDocument(documentId, documentTypeId, schema, options)
        results.completed.push(documentId)
        completedCount++
        onProgress?.(completedCount, documentIds.length, documentId)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.failed.push({ documentId, error: errorMessage })
        completedCount++
        onProgress?.(completedCount, documentIds.length, documentId, error as Error)
      }
    })()

    processing.add(promise)
    promise.finally(() => processing.delete(promise))
  }

  // Wait for all remaining operations to complete
  await Promise.all(processing)

  return results
}

/**
 * Get streaming object generator for a document (used by streaming API)
 */
export async function getDocumentStreamingProcessor(
  documentId: string,
  documentTypeId: string,
  schema: any,
  options: ProcessingOptions = {},
) {
  const { skipValidation = false, overrideModel } = options

  // Get the model and provider to use
  const { provider, modelName } = await getModelAndProviderForProcessing(
    documentTypeId,
    overrideModel,
  )

  // Get the document type for validation
  const docType = await getDocumentType(documentTypeId)
  if (!docType) {
    throw new Error('Document type not found')
  }

  // Get the document
  const doc = await getDocument(documentId)
  if (!doc) {
    throw new Error('Document not found')
  }

  // Load document file from storage
  const fileBuffer = await loadDocumentFile(doc.storagePath)

  // Validate document type if validation instructions exist (unless explicitly skipped)
  if (!skipValidation) {
    const validation = await validateDocument(docType, fileBuffer, doc.filename, provider, modelName)

    if (!validation.isValid) {
      // Save rejection to database
      const rejectionFormData = new FormData()
      rejectionFormData.append('status', 'rejected')
      rejectionFormData.append(
        'rejectionReason',
        validation.reason || 'Document does not match expected type',
      )
      const rejectedDoc = await updateDocument(documentId, rejectionFormData)

      // Return rejection info for client handling
      return {
        rejected: true,
        reason: validation.reason || 'Document does not match expected type',
        document: rejectedDoc,
      }
    }
  }

  // Build message content with schema in text (for streaming)
  const messageContent = buildMessageContent(fileBuffer, doc.filename, schema, true)
  const messages = [
    {
      role: 'user' as const,
      content: messageContent,
    },
  ]

  // Return stream text result (used by API route)
  const result = streamText({
    model: provider.getModel(modelName),
    system: getSystemPrompt(),
    messages,
  })

  return result
}
