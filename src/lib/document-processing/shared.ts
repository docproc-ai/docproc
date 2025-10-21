import { jsonSchema, ModelMessage } from 'ai'
import type { getDocument } from '@/lib/actions/document'
import type { getDocumentType } from '@/lib/actions/document-type'
import { getModelForProcessing } from '@/lib/providers'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getStorageDir } from '@/lib/storage'

/**
 * Shared types and interfaces
 */
export interface ValidationResult {
  isValid: boolean
  reason?: string
}

export interface PreprocessedDocumentData {
  documentId: string
  documentTypeId: string
  schema: any
  provider: any
  modelName: string
  doc: Awaited<ReturnType<typeof getDocument>>
  docType: Awaited<ReturnType<typeof getDocumentType>>
  fileBuffer: Buffer
  messages: ModelMessage[]
  schemaForAI: any
}

export interface ProcessingOptions {
  skipValidation?: boolean
  overrideModel?: string
}

/**
 * Get system prompt with current date context
 */
export function getSystemPrompt(): string {
  const currentDate = new Date()
  const isoDate = currentDate.toISOString().split('T')[0]
  const readableDate = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `
You are an expert document processor. Your task is to analyze the provided document (which could be a PDF or an image) and extract information into a structured JSON object based on the user-provided schema.

**CURRENT DATE**: ${isoDate} (${readableDate})

**CRITICAL INSTRUCTIONS:**
1.  **Analyze the ENTIRE document provided.**
2.  **Date Formatting**: For any date field, you MUST format it as \`YYYY-MM-DD\`.
3.  **Do NOT Guess**: If you cannot find information for a field, OMIT it from your response. Do not hallucinate data. Even if a field is required in the schema, if the information is not present in the document, it should not be included.
4.  **Follow Schema**: Adhere strictly to the JSON schema for the output format. Pay close attention to field names, types, and nested structures. The exception is that you can omit fields that are not present in the document or that you are unsure of.
5.  **Date Context**: Use the current date above as reference when interpreting relative dates or incomplete dates in documents (e.g., "last month", "Q1", etc.).
6.  **JSON OUTPUT ONLY**: Your response must be ONLY valid JSON. Do not include any explanatory text, markdown formatting, or code blocks. Start with { and end with }.
`.trim()
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(extension: string): string {
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

/**
 * Get the model and provider to use for processing a document type
 * Priority: overrideModel > documentType.modelName > system default
 */
export async function getModelAndProviderForProcessing(
  documentTypeId: string,
  overrideModel?: string,
) {
  const { getDocumentType } = await import('@/lib/actions/document-type')
  const docType = await getDocumentType(documentTypeId)
  return getModelForProcessing(docType?.providerName, docType?.modelName, overrideModel)
}

/**
 * Build message content array for AI SDK
 */
export function buildMessageContent(
  fileBuffer: Buffer,
  filename: string,
  schema?: any,
  includeSchemaInText?: boolean,
): Array<
  | { type: 'text'; text: string }
  | { type: 'image'; image: Buffer }
  | { type: 'file'; data: Buffer; mediaType: string; filename?: string }
> {
  const fileExtension = filename.toLowerCase().split('.').pop()
  const mimeType = getMimeType(fileExtension || '')

  const messageContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; image: Buffer }
    | { type: 'file'; data: Buffer; mediaType: string; filename?: string }
  > = []

  // Add text instruction
  if (includeSchemaInText && schema) {
    messageContent.push({
      type: 'text',
      text: `Please analyze the attached document and extract the data according to the provided schema.

Schema to follow:
${JSON.stringify(schema, null, 2)}

Remember: Output ONLY valid JSON that matches this schema. No explanatory text.`,
    })
  } else {
    messageContent.push({
      type: 'text',
      text: `Please analyze the attached document and extract the data according to the provided schema.`,
    })
  }

  // Add file content
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

  return messageContent
}

/**
 * Load document file from storage
 */
export async function loadDocumentFile(storagePath: string): Promise<Buffer> {
  const filePath = join(getStorageDir(), storagePath)
  return readFile(filePath)
}

/**
 * Prepare schema for AI SDK
 */
export function prepareSchemaForAI(schema: any): any {
  const rawSchema = {
    ...schema,
    type: 'object',
    properties: schema.properties || {},
  }

  return jsonSchema<any>(rawSchema)
}
