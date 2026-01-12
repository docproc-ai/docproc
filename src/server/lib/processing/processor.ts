import { OpenRouter } from '@openrouter/sdk'
import { streamObject } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { jsonrepair } from 'jsonrepair'
import { jsonSchema } from 'ai'
import { storage } from '../../storage'
import { getDocument, updateDocument } from '../db/document-operations'
import { getDocumentType } from '../db/document-type-operations'
import {
  getSystemPrompt,
  getMimeType,
  getFileExtension,
  getModelForProcessing,
  type ValidationResult,
  type ProcessingOptions,
  type ProcessingResult,
} from './shared'

// Initialize OpenRouter client (for non-streaming)
const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

// Initialize AI SDK OpenRouter provider (for streaming)
const openrouterProvider = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

/**
 * Build message content for OpenRouter chat API
 * Handles both images and PDFs using base64 encoding
 */
function buildMessageContent(
  fileBuffer: Buffer,
  filename: string,
  schema: Record<string, unknown>,
): Array<{ type: 'text'; text: string } | { type: 'image_url'; imageUrl: { url: string } }> {
  const extension = getFileExtension(filename)
  const mimeType = getMimeType(extension)
  const base64Data = fileBuffer.toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64Data}`

  const content: Array<
    { type: 'text'; text: string } | { type: 'image_url'; imageUrl: { url: string } }
  > = [
    {
      type: 'text',
      text: `Please analyze the attached document and extract the data according to the provided schema.

Schema to follow:
${JSON.stringify(schema, null, 2)}

Remember: Output ONLY valid JSON that matches this schema. No explanatory text.`,
    },
    {
      type: 'image_url',
      imageUrl: {
        url: dataUrl,
      },
    },
  ]

  return content
}

/**
 * Validate if a document matches the expected document type
 * Returns early with isValid=true if no validation instructions are set
 */
export async function validateDocument(
  validationInstructions: string | null | undefined,
  fileBuffer: Buffer,
  filename: string,
  modelName: string,
): Promise<ValidationResult> {
  // Skip validation if no instructions provided
  if (!validationInstructions?.trim()) {
    return { isValid: true }
  }

  const extension = getFileExtension(filename)
  const mimeType = getMimeType(extension)
  const base64Data = fileBuffer.toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64Data}`

  try {
    const result = await openrouter.chat.send({
      model: modelName,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Validate if this document matches the expected type.

${validationInstructions}

Respond with a JSON object containing:
- "isValid": boolean (true if document matches, false otherwise)
- "reason": string (explanation of your assessment)

Output ONLY valid JSON. No explanatory text.`,
            },
            {
              type: 'image_url',
              imageUrl: {
                url: dataUrl,
              },
            },
          ],
        },
      ],
      stream: false,
    })

    const messageContent = result.choices[0]?.message?.content
    const responseText = typeof messageContent === 'string' ? messageContent : ''
    const repairedJson = jsonrepair(responseText.trim())
    const validationResult = JSON.parse(repairedJson) as ValidationResult

    return validationResult
  } catch (error) {
    console.error('Validation failed:', error)
    // On validation error, allow processing to continue
    return { isValid: true, reason: 'Validation check failed, proceeding with processing' }
  }
}

/**
 * Process a single document and extract structured data
 */
export async function processDocument(
  documentId: string,
  options: ProcessingOptions = {},
): Promise<ProcessingResult> {
  const { skipValidation = false, overrideModel } = options

  // Get the document
  const doc = await getDocument(documentId)
  if (!doc) {
    throw new Error('Document not found')
  }

  // Get the document type
  const docType = await getDocumentType(doc.documentTypeId)
  if (!docType) {
    throw new Error('Document type not found')
  }

  const schema = docType.schema as Record<string, unknown>
  const modelName = getModelForProcessing(docType.modelName, overrideModel)

  // Load document file from storage
  const { buffer: fileBuffer } = await storage.download(doc.storagePath)

  // Validate document type if validation instructions exist
  let validation: ValidationResult | undefined
  if (!skipValidation) {
    validation = await validateDocument(
      docType.validationInstructions,
      fileBuffer,
      doc.filename,
      modelName,
    )

    if (!validation.isValid) {
      // Save rejection to database
      await updateDocument(documentId, {
        status: 'rejected',
        rejectionReason: validation.reason || 'Document does not match expected type',
      })

      throw new Error(
        `Document validation failed: ${validation.reason || 'Document does not match expected type'}`,
      )
    }
  }

  // Build message content
  const userMessageContent = buildMessageContent(fileBuffer, doc.filename, schema)

  // Call OpenRouter API
  const result = await openrouter.chat.send({
    model: modelName,
    messages: [
      {
        role: 'system',
        content: getSystemPrompt(),
      },
      {
        role: 'user',
        content: userMessageContent,
      },
    ],
    stream: false,
  })

  // Parse the response
  const responseContent = result.choices[0]?.message?.content
  const responseText = typeof responseContent === 'string' ? responseContent : ''

  let extractedData: Record<string, unknown>
  try {
    const repairedJson = jsonrepair(responseText.trim())
    extractedData = JSON.parse(repairedJson)
  } catch (parseError) {
    console.error('Failed to parse JSON response for document:', documentId, parseError)
    console.error('Raw response text:', responseText)
    throw new Error('Model returned invalid JSON')
  }

  return { data: extractedData, validation }
}

/**
 * Process a document and save results to database
 * Main entry point for document processing
 */
export async function processAndSaveDocument(
  documentId: string,
  options: ProcessingOptions = {},
): Promise<{ data: Record<string, unknown>; document: Awaited<ReturnType<typeof getDocument>> }> {
  // Get document type to capture schema snapshot
  const doc = await getDocument(documentId)
  if (!doc) {
    throw new Error('Document not found')
  }

  const docType = await getDocumentType(doc.documentTypeId)
  if (!docType) {
    throw new Error('Document type not found')
  }

  const { data, validation } = await processDocument(documentId, options)

  // Update document with extracted data
  const updatedDoc = await updateDocument(documentId, {
    extractedData: data,
    status: 'processed',
    schemaSnapshot: docType.schema as Record<string, unknown>,
  })

  // Validation rejection is already handled in processDocument
  if (validation && !validation.isValid) {
    throw new Error(
      `Document validation failed: ${validation.reason || 'Document does not match expected type'}`,
    )
  }

  return { data, document: updatedDoc }
}

/**
 * Process a document with AI SDK streaming support
 * Uses streamObject for proper partial object streaming
 */
export async function* processDocumentStreaming(
  documentId: string,
  options: ProcessingOptions = {},
): AsyncGenerator<{ type: 'partial' | 'complete'; data: Record<string, unknown> }, void, unknown> {
  const { skipValidation = false, overrideModel } = options

  // Get the document
  const doc = await getDocument(documentId)
  if (!doc) {
    throw new Error('Document not found')
  }

  // Get the document type
  const docType = await getDocumentType(doc.documentTypeId)
  if (!docType) {
    throw new Error('Document type not found')
  }

  const schema = docType.schema as Record<string, unknown>
  const modelName = getModelForProcessing(docType.modelName, overrideModel)

  // Load document file from storage
  const { buffer: fileBuffer } = await storage.download(doc.storagePath)

  // Validate document type if validation instructions exist
  if (!skipValidation) {
    const validation = await validateDocument(
      docType.validationInstructions,
      fileBuffer,
      doc.filename,
      modelName,
    )

    if (!validation.isValid) {
      await updateDocument(documentId, {
        status: 'rejected',
        rejectionReason: validation.reason || 'Document does not match expected type',
      })

      throw new Error(
        `Document validation failed: ${validation.reason || 'Document does not match expected type'}`,
      )
    }
  }

  // Build message content for AI SDK format
  const extension = getFileExtension(doc.filename)
  const mimeType = getMimeType(extension)
  const base64Data = fileBuffer.toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64Data}`

  // Use AI SDK streamObject for proper partial streaming
  const { partialObjectStream } = streamObject({
    model: openrouterProvider(modelName),
    schema: jsonSchema(schema),
    system: getSystemPrompt(),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Please analyze the attached document and extract the data according to the provided schema.`,
          },
          {
            type: 'image',
            image: dataUrl,
          },
        ],
      },
    ],
  })

  // Stream partial results
  let finalData: Record<string, unknown> = {}
  for await (const partialObject of partialObjectStream) {
    finalData = partialObject as Record<string, unknown>
    yield { type: 'partial', data: finalData }
  }

  // Save to database
  await updateDocument(documentId, {
    extractedData: finalData,
    status: 'processed',
    schemaSnapshot: schema,
  })

  yield { type: 'complete', data: finalData }
}

/**
 * Prepare document data for streaming without starting the stream
 * Returns all context needed to call streamObject in the route handler
 */
export async function prepareDocumentForStreaming(
  documentId: string,
  options: ProcessingOptions = {},
): Promise<{
  schema: Record<string, unknown>
  modelName: string
  systemPrompt: string
  messages: Array<{
    role: 'user'
    content: Array<{ type: 'text'; text: string } | { type: 'image'; image: string }>
  }>
  documentId: string
  updateDocumentOnComplete: (data: Record<string, unknown>) => Promise<void>
}> {
  const { skipValidation = false, overrideModel } = options

  // Get the document
  const doc = await getDocument(documentId)
  if (!doc) {
    throw new Error('Document not found')
  }

  // Get the document type
  const docType = await getDocumentType(doc.documentTypeId)
  if (!docType) {
    throw new Error('Document type not found')
  }

  const schema = docType.schema as Record<string, unknown>
  const modelName = getModelForProcessing(docType.modelName, overrideModel)

  // Load document file from storage
  const { buffer: fileBuffer } = await storage.download(doc.storagePath)

  // Validate document type if validation instructions exist
  if (!skipValidation) {
    const validation = await validateDocument(
      docType.validationInstructions,
      fileBuffer,
      doc.filename,
      modelName,
    )

    if (!validation.isValid) {
      await updateDocument(documentId, {
        status: 'rejected',
        rejectionReason: validation.reason || 'Document does not match expected type',
      })

      throw new Error(
        `Document validation failed: ${validation.reason || 'Document does not match expected type'}`,
      )
    }
  }

  // Build message content for AI SDK format
  const extension = getFileExtension(doc.filename)
  const mimeType = getMimeType(extension)
  const base64Data = fileBuffer.toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64Data}`

  return {
    schema,
    modelName,
    systemPrompt: getSystemPrompt(),
    messages: [
      {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text: `Please analyze the attached document and extract the data according to the provided schema.

Schema to follow:
${JSON.stringify(schema, null, 2)}

Remember: Output ONLY valid JSON that matches this schema. No explanatory text.`,
          },
          {
            type: 'image' as const,
            image: dataUrl,
          },
        ],
      },
    ],
    documentId,
    updateDocumentOnComplete: async (data: Record<string, unknown>) => {
      await updateDocument(documentId, {
        extractedData: data,
        status: 'processed',
        schemaSnapshot: schema,
      })
    },
  }
}
