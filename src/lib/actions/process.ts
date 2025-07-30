'use server'

import { generateObject, streamObject, jsonSchema, ModelMessage } from 'ai'
import { getDocument, updateDocument } from './document'
import { anthropic } from '@ai-sdk/anthropic'
import { getDocumentType } from './document-type'
import { DEFAULT_MODEL } from '@/lib/models/anthropic'
import { checkDocumentPermissions } from '../auth-utils'
import { join } from 'node:path'
import { getStorageDir } from '../storage'
import { readFile } from 'node:fs/promises'

/**
 * Get the model to use for processing a document type
 * Priority: overrideModel > documentType.modelName > system default
 */
async function getModelForProcessing(
  documentTypeId: string,
  overrideModel?: string,
): Promise<string> {
  if (overrideModel) {
    return overrideModel
  }

  const docType = await getDocumentType(documentTypeId)
  if (docType?.modelName) {
    return docType.modelName
  }

  // System default
  return DEFAULT_MODEL
}

function getMimeType(extension: string): string {
  const mimeTypes: { [key: string]: string } = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
  }

  return mimeTypes[extension] || 'application/octet-stream'
}

const SYSTEM_PROMPT = `
You are an expert document processor. Your task is to analyze the provided document (which could be a PDF or an image) and extract information into a structured JSON object based on the user-provided schema.

**CRITICAL INSTRUCTIONS:**
1.  **Analyze the ENTIRE document provided.**
2.  **Date Formatting**: For any date field, you MUST format it as \`YYYY-MM-DD\`.
3.  **Do NOT Guess**: If you cannot find information for a field, OMIT it from your response. Do not hallucinate data. Even if a field is required in the schema, if the information is not present in the document, it should not be included.
4.  **Follow Schema**: Adhere strictly to the JSON schema for the output format. Pay close attention to field names, types, and nested structures. The exception is that you can omit fields that are not present in the document or that you are unsure of.
`.trim()

interface PreprocessedDocumentData {
  documentId: string
  documentTypeId: string
  schema: any
  modelToUse: string
  doc: any
  fileBuffer: Buffer
  messages: ModelMessage[]
  schemaForAI: any
}

async function preprocessDocument(formData: FormData): Promise<PreprocessedDocumentData> {
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

  // Get the model to use (document type model or override)
  const modelToUse = await getModelForProcessing(documentTypeId, overrideModel)

  // Get the document
  const doc = await getDocument(documentId)
  if (!doc) {
    throw new Error('Document not found')
  }

  // Read the document file from storage
  const filePath = join(getStorageDir(), doc.storagePath)
  const fileBuffer = await readFile(filePath)

  // Prepare the raw schema object, ensuring it has a root 'type' and 'properties'
  const rawSchema = {
    ...schema,
    type: 'object',
    properties: schema.properties || {},
  }

  // Use the `jsonSchema` helper from the AI SDK to create a compatible schema object
  const schemaForAI = jsonSchema<any>(rawSchema)

  // Determine file type from filename
  const fileExtension = doc.filename.toLowerCase().split('.').pop()
  const mimeType = getMimeType(fileExtension || '')

  // Build the message content array for AI SDK v5
  const messageContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; image: Buffer }
    | { type: 'file'; data: Buffer; mediaType: string; filename?: string }
  > = [
    {
      type: 'text',
      text: `Please analyze the attached document and extract the data according to the provided schema.`,
    },
  ]

  if (mimeType.startsWith('image/')) {
    messageContent.push({ type: 'image', image: fileBuffer })
  } else {
    messageContent.push({
      type: 'file',
      data: fileBuffer,
      mediaType: mimeType,
      filename: doc.filename,
    })
  }

  // Create the ModelMessage array
  const messages: ModelMessage[] = [
    {
      role: 'user',
      content: messageContent,
    },
  ]

  return {
    documentId,
    documentTypeId,
    schema,
    modelToUse,
    doc,
    fileBuffer,
    messages,
    schemaForAI,
  }
}

export async function processDocument(formData: FormData) {
  try {
    const { documentId, schema, modelToUse, messages, schemaForAI } =
      await preprocessDocument(formData)

    const { object } = await generateObject({
      model: anthropic(modelToUse),
      schema: schemaForAI,
      system: SYSTEM_PROMPT,
      messages,
    })

    // Update document with extracted data
    const updateFormData = new FormData()
    updateFormData.append('extractedData', JSON.stringify(object))
    updateFormData.append('status', 'processed')
    updateFormData.append('schemaSnapshot', JSON.stringify(schema))

    const updatedDoc = await updateDocument(documentId, updateFormData)

    return { data: object, document: updatedDoc }
  } catch (error) {
    console.error('Failed to process document:', error)
    throw error
  }
}

export async function processDocumentStream(formData: FormData) {
  try {
    const { documentId, schema, modelToUse, messages, schemaForAI } =
      await preprocessDocument(formData)

    const { partialObjectStream } = await streamObject({
      model: anthropic(modelToUse),
      schema: schemaForAI,
      system: SYSTEM_PROMPT,
      messages,
    })

    return partialObjectStream
  } catch (error) {
    console.error('Failed to process document stream:', error)
    throw error
  }
}
