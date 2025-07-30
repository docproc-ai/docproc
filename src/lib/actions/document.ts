'use server'

import { db } from '@/db'
import { document, documentType } from '@/db/schema'
import { checkDocumentPermissions } from '@/lib/auth-utils'
import { getStorageDir } from '@/lib/storage'
import { randomUUID } from 'crypto'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { desc, eq } from 'drizzle-orm'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { revalidatePath } from 'next/cache'
import { join } from 'path'

export type Document = InferSelectModel<typeof document>
export type NewDocument = InferInsertModel<typeof document>

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
