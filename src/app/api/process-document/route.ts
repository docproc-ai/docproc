import { getDocument } from '@/lib/actions/document'
import { getDocumentType } from '@/lib/actions/document-type'
import { checkDocumentPermissions } from '@/lib/auth-utils'
import { getModelForProcessing } from '@/lib/providers'
import { getStorageDir } from '@/lib/storage'
import { streamText, generateText } from 'ai'
import { NextRequest } from 'next/server'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { checkApiAuth } from '@/lib/api-auth'
import { checkAIRateLimit } from '@/lib/ai-rate-limit'
import { jsonrepair } from 'jsonrepair'

/**
 * Get the model and provider to use for processing a document type
 * Priority: overrideModel > documentType.modelName > system default
 */
async function getModelAndProviderForProcessing(documentTypeId: string, overrideModel?: string) {
  const docType = await getDocumentType(documentTypeId)
  return getModelForProcessing(docType?.providerName, docType?.modelName, overrideModel)
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

function getSystemPrompt(): string {
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

export async function POST(req: NextRequest) {
  try {
    // Check if user has permission to process documents (or has valid API key)
    const authCheck = await checkApiAuth({
      document: ['update'], // Processing documents requires update permission
    })

    if (!authCheck.success) {
      return new Response('Insufficient permissions', { status: 403 })
    }

    // Check if streaming mode is requested
    const url = new URL(req.url)
    const isStreamMode = url.searchParams.get('stream') === 'true'

    const body = await req.json()
    const { documentId, documentTypeId, schema: schemaString, model: overrideModel } = body

    if (!documentId || !documentTypeId || !schemaString) {
      return new Response('Document ID, document type ID, and schema are required', {
        status: 400,
      })
    }

    // Check AI rate limit after parsing request body
    try {
      await checkAIRateLimit('process-document')
    } catch (error) {
      return new Response(error instanceof Error ? error.message : 'Rate limit exceeded', {
        status: 429,
      })
    }

    // Validate admin privileges for model override
    let validatedOverrideModel = overrideModel
    if (overrideModel) {
      const permissionCheck = await checkDocumentPermissions(['update'])
      if (!permissionCheck.success) {
        // Non-admin users cannot override models - ignore the parameter
        validatedOverrideModel = undefined
        console.warn(
          'Non-admin user attempted to override model in processDocument, ignoring parameter',
        )
      }
    }

    let schema
    try {
      schema = JSON.parse(schemaString)
    } catch {
      return new Response('Invalid schema JSON', { status: 400 })
    }

    // Get the model and provider to use
    const { provider, modelName } = await getModelAndProviderForProcessing(
      documentTypeId,
      validatedOverrideModel,
    )

    // Get the document
    const doc = await getDocument(documentId)
    if (!doc) {
      return new Response('Document not found', { status: 404 })
    }

    // Read the document file from storage
    const filePath = join(getStorageDir(), doc.storagePath)
    const fileBuffer = await readFile(filePath)

    // Determine file type from filename
    const fileExtension = doc.filename.toLowerCase().split('.').pop()
    const mimeType = getMimeType(fileExtension || '')

    // Build the message content array for AI SDK v5
    const messageContent: Array<
      | { type: 'text'; text: string }
      | { type: 'image'; image: Buffer }
      | { type: 'file'; data: Buffer; mediaType: string; filename?: string }
    > = []

    // Include schema in the message for text generation
    messageContent.push({
      type: 'text',
      text: `Please analyze the attached document and extract the data according to the provided schema.

Schema to follow:
${JSON.stringify(schema, null, 2)}

Remember: Output ONLY valid JSON that matches this schema. No explanatory text.`,
    })

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

    // Create the messages array
    const messages = [
      {
        role: 'user' as const,
        content: messageContent,
      },
    ]

    if (isStreamMode) {
      // Streaming mode for single document processing
      console.log('🔄 Processing document in STREAMING mode:', documentId)
      const result = streamText({
        model: provider.getModel(modelName),
        system: getSystemPrompt(),
        messages,
      })

      return result.toTextStreamResponse()
    } else {
      // Non-streaming mode for batch processing
      console.log('⚡ Processing document in NON-STREAMING mode:', documentId)

      const { text } = await generateText({
        model: provider.getModel(modelName),
        system: getSystemPrompt(),
        messages,
      })

      // Parse the JSON response using jsonrepair (same as streaming hook)
      let extractedData
      try {
        const repairedJson = jsonrepair(text.trim())
        extractedData = JSON.parse(repairedJson)
        console.log('✅ Successfully parsed extracted data for document:', documentId)
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response for document:', documentId, parseError)
        console.error('Raw response text:', text)
        return new Response('Failed to parse AI response as JSON', { status: 500 })
      }

      return Response.json({
        success: true,
        data: extractedData,
        documentId,
      })
    }
  } catch (error) {
    console.error('Failed to process document:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
