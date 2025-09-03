'use server'

import { db } from '@/db'
import { document, documentType } from '@/db/schema'
import { checkDocumentPermissions } from '@/lib/auth-utils'
import { getStorageDir } from '@/lib/storage'
import {
  decryptWebhookConfig,
  type DocumentWebhookConfig,
  type DocumentWebhookEventName,
} from '@/lib/webhook-encryption'
import { randomUUID } from 'crypto'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { desc, eq } from 'drizzle-orm'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { revalidatePath } from 'next/cache'
import { join } from 'path'
import { PDFDocument, degrees } from 'pdf-lib'
import sharp from 'sharp'

export type Document = InferSelectModel<typeof document>
export type NewDocument = InferInsertModel<typeof document>

async function triggerWebhook(
  documentType: any,
  document: Document,
  event: DocumentWebhookEventName,
) {
  if (!documentType.webhookConfig) return

  const webhookConfig = decryptWebhookConfig(documentType.webhookConfig as DocumentWebhookConfig)
  const eventConfig = webhookConfig.events?.[event]

  if (!eventConfig || !eventConfig.enabled || !eventConfig.url) return

  const payload = {
    event,
    documentType: {
      id: documentType.id,
      name: documentType.name,
    },
    document,
    timestamp: new Date().toISOString(),
  }

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Docproc/1.0',
  }

  // Add custom headers
  if (eventConfig.headers) {
    for (const header of eventConfig.headers) {
      headers[header.name] = header.value
    }
  }

  const response = await fetch(eventConfig.url, {
    method: eventConfig.method || 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Webhook failed with status ${response.status}: ${response.statusText}`)
  }
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

    // Get document type for webhook trigger
    const [docType] = await db
      .select()
      .from(documentType)
      .where(eq(documentType.id, documentTypeId))

    // Trigger uploaded webhook
    if (docType) {
      try {
        await triggerWebhook(docType, result, 'document.uploaded')
      } catch (webhookError) {
        console.error('Webhook failed:', webhookError)
        // Don't fail the creation if webhook fails
      }
    }

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

    // Get current document to check previous status
    const [currentDoc] = await db.select().from(document).where(eq(document.id, id))
    if (!currentDoc) {
      throw new Error('Document not found')
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

    // Trigger appropriate webhook based on status change
    if (status && status !== currentDoc.status && docType) {
      let webhookEvent: DocumentWebhookEventName | null = null

      // Check for unapproval first (leaving approved status)
      if (currentDoc.status === 'approved' && (status === 'pending' || status === 'processed')) {
        webhookEvent = 'document.unapproved'
      } else if (status === 'processed') {
        webhookEvent = 'document.processed'
      } else if (status === 'approved') {
        webhookEvent = 'document.approved'
      }

      if (webhookEvent) {
        try {
          await triggerWebhook(docType, result, webhookEvent)
        } catch (webhookError) {
          console.error('Webhook failed:', webhookError)
          // Don't fail the update if webhook fails
        }
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

export async function rotateDocument(documentId: string, rotationDegrees: number) {
  try {
    // Check permissions
    const permissionCheck = await checkDocumentPermissions(['update'])
    if (!permissionCheck.success) {
      throw new Error('Insufficient permissions to rotate document')
    }

    // Get the document
    const doc = await getDocument(documentId)
    if (!doc) {
      throw new Error('Document not found')
    }

    // Read the document file from storage
    const filePath = join(getStorageDir(), doc.storagePath)
    const fileBuffer = await readFile(filePath)

    let rotatedBuffer: Buffer

    // Determine file type and rotate accordingly
    const fileExtension = doc.filename.toLowerCase().split('.').pop()

    if (fileExtension === 'pdf') {
      // Handle PDF rotation - apply relative rotation
      const pdfDoc = await PDFDocument.load(fileBuffer)
      const pages = pdfDoc.getPages()

      // Apply relative rotation to all pages
      pages.forEach((page: any) => {
        const currentRotation = page.getRotation().angle || 0
        page.setRotation(degrees(currentRotation + rotationDegrees))
      })

      rotatedBuffer = Buffer.from(await pdfDoc.save())
    } else if (['jpg', 'jpeg', 'png', 'webp', 'tiff', 'bmp'].includes(fileExtension || '')) {
      // Handle image rotation using Sharp - applies relative rotation
      rotatedBuffer = await sharp(fileBuffer).rotate(rotationDegrees).toBuffer()
    } else {
      throw new Error('Unsupported file type for rotation')
    }

    // Write the rotated file back to storage
    await writeFile(filePath, rotatedBuffer)

    // Revalidate any cached data
    revalidatePath(`/api/documents/${documentId}/file`)

    return { success: true }
  } catch (error) {
    console.error('Error rotating document:', error)
    throw new Error(error instanceof Error ? error.message : 'Failed to rotate document')
  }
}
