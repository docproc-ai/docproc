'use server'

import { db } from '@/db'
import { document, documentType } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { writeFile, unlink, mkdir, readFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { getStorageDir } from '@/lib/storage'
import { anthropic } from '@ai-sdk/anthropic'
import { generateObject, jsonSchema } from 'ai'
import { getDocumentType } from './document-type'
import { DEFAULT_MODEL } from '@/lib/models/anthropic'
import { checkDocumentPermissions } from '@/lib/auth-utils'

export type Document = InferSelectModel<typeof document>
export type NewDocument = InferInsertModel<typeof document>

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

async function triggerWebhook(documentType: any, document: Document) {
  if (!documentType.webhookUrl) return

  const method = documentType.webhookMethod || 'POST'
  const payload = {
    event: 'document.approved',
    documentType: {
      id: documentType.id,
      name: documentType.name,
    },
    document: {
      id: document.id,
      filename: document.filename,
      status: document.status,
      extractedData: document.extractedData,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    },
    timestamp: new Date().toISOString(),
  }

  const response = await fetch(documentType.webhookUrl, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Docproc/1.0',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Webhook failed with status ${response.status}: ${response.statusText}`)
  }

  console.log(`Webhook triggered successfully for document ${document.id}`)
}

export async function getDocuments(documentTypeId: string): Promise<Document[]> {
  // Check document list permissions
  const permissionCheck = await checkDocumentPermissions(['list'])
  if (!permissionCheck.success) {
    console.error('Permission denied for listing documents:', permissionCheck.error)
    return []
  }

  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.documentTypeId, documentTypeId))
      .orderBy(desc(document.createdAt))

    return documents
  } catch (error) {
    console.error('Failed to get documents:', error)
    return []
  }
}

export async function getDocument(id: string): Promise<Document | null> {
  try {
    const [result] = await db.select().from(document).where(eq(document.id, id))
    return result || null
  } catch (error) {
    console.error('Failed to get document:', error)
    return null
  }
}

export async function createDocument(formData: FormData) {
  // Check document creation permissions
  const permissionCheck = await checkDocumentPermissions(['create'])
  if (!permissionCheck.success) {
    throw new Error(permissionCheck.error)
  }

  try {
    const file = formData.get('file') as File
    const documentTypeId = formData.get('documentTypeId') as string

    if (!file || !documentTypeId) {
      throw new Error('File and document type ID are required')
    }

    // Create storage directory if it doesn't exist
    const storageDir = getStorageDir()
    await mkdir(storageDir, { recursive: true })

    // Generate unique filename
    const fileExtension = file.name.split('.').pop()
    const uniqueFilename = `${randomUUID()}.${fileExtension}`
    const storagePath = join(storageDir, uniqueFilename)

    // Save file to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(storagePath, buffer)

    // Save document record to database
    const [result] = await db
      .insert(document)
      .values({
        filename: file.name,
        storagePath: uniqueFilename, // Store relative path
        documentTypeId,
        status: 'pending',
        extractedData: {},
        schemaSnapshot: null,
      })
      .returning()

    revalidatePath(`/process/${documentTypeId}`)
    return result
  } catch (error) {
    console.error('Failed to create document:', error)
    throw error
  }
}

export async function updateDocument(id: string, formData: FormData) {
  // Check document update permissions
  const permissionCheck = await checkDocumentPermissions(['update'])
  if (!permissionCheck.success) {
    throw new Error(permissionCheck.error)
  }

  try {
    const extractedDataString = formData.get('extractedData') as string
    const status = formData.get('status') as 'pending' | 'processed' | 'approved'
    const schemaSnapshotString = formData.get('schemaSnapshot') as string

    let extractedData = {}
    let schemaSnapshot = null

    if (extractedDataString) {
      try {
        extractedData = JSON.parse(extractedDataString)
      } catch {
        throw new Error('Invalid extracted data JSON')
      }
    }

    if (schemaSnapshotString) {
      try {
        schemaSnapshot = JSON.parse(schemaSnapshotString)
      } catch {
        throw new Error('Invalid schema snapshot JSON')
      }
    }

    const updateData: any = {
      extractedData,
      schemaSnapshot,
      updatedAt: new Date(),
    }

    if (status) {
      updateData.status = status
    }

    const [result] = await db
      .update(document)
      .set(updateData)
      .where(eq(document.id, id))
      .returning()

    if (!result) {
      throw new Error('Document not found')
    }

    // Get document type for webhook and revalidation
    const [docType] = await db
      .select()
      .from(documentType)
      .where(eq(documentType.id, result.documentTypeId))

    // Trigger webhook if document is approved and webhook is configured
    if (status === 'approved' && docType?.webhookUrl) {
      try {
        await triggerWebhook(docType, result)
      } catch (webhookError) {
        console.error('Webhook failed:', webhookError)
        // Don't fail the update if webhook fails
      }
    }

    if (docType) {
      revalidatePath(`/process/${docType.id}`)
    }

    return result
  } catch (error) {
    console.error('Failed to update document:', error)
    throw error
  }
}

export async function deleteDocument(id: string) {
  // Check document deletion permissions
  const permissionCheck = await checkDocumentPermissions(['delete'])
  if (!permissionCheck.success) {
    throw new Error(permissionCheck.error)
  }

  try {
    // Get document info before deletion
    const [doc] = await db.select().from(document).where(eq(document.id, id))

    if (!doc) {
      throw new Error('Document not found')
    }

    // Delete file from storage
    const storagePath = join(getStorageDir(), doc.storagePath)
    try {
      await unlink(storagePath)
    } catch (error) {
      console.warn('Failed to delete file from storage:', error)
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await db.delete(document).where(eq(document.id, id))

    revalidatePath(`/process/${doc.documentTypeId}`)
  } catch (error) {
    console.error('Failed to delete document:', error)
    throw error
  }
}

export async function processDocument(formData: FormData) {
  try {
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

    const messageContent: (
      | { type: 'text'; text: string }
      | { type: 'image'; image: Buffer }
      | { type: 'file'; data: Buffer; mimeType?: string; filename?: string }
    )[] = [
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
        mimeType: mimeType,
        filename: doc.filename,
      })
    }

    const { object } = await generateObject({
      model: anthropic(modelToUse),
      schema: schemaForAI,
      system: `You are an expert document processor. Your task is to analyze the provided document (which could be a PDF or an image) and extract information into a structured JSON object based on the user-provided schema.

**CRITICAL INSTRUCTIONS:**
1.  **Analyze the ENTIRE document provided.**
2.  **Date Formatting**: For any date field, you MUST format it as \`YYYY-MM-DD\`.
3.  **Do NOT Guess**: If you cannot find information for a field, OMIT it from your response. Do not hallucinate data. Even if a field is required in the schema, if the information is not present in the document, it should not be included.
4.  **Follow Schema**: Adhere strictly to the JSON schema for the output format. Pay close attention to field names, types, and nested structures. The exception is that you can omit fields that are not present in the document or that you are unsure of.`,
      messages: [
        {
          role: 'user',
          content: messageContent as any,
        },
      ],
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
