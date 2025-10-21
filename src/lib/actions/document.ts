'use server'

import { db } from '@/db'
import { document, documentType } from '@/db/schema'
import { checkDocumentPermissions } from '@/lib/auth-utils'
import { getStorageDir } from '@/lib/storage'
import { triggerWebhook, type DocumentWebhookEventName } from '@/lib/webhooks'
import { randomUUID } from 'crypto'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { desc, eq, and, or, count, like } from 'drizzle-orm'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { revalidatePath } from 'next/cache'
import { join } from 'path'
import { PDFDocument, degrees } from 'pdf-lib'
import sharp from 'sharp'

export type Document = InferSelectModel<typeof document>
export type NewDocument = InferInsertModel<typeof document>

export interface GetDocumentsOptions {
  page?: number
  pageSize?: number
  status?: 'pending' | 'processed' | 'approved' | 'rejected' | 'all' | string // Allow comma-separated values
  search?: string
}

export interface GetDocumentsResult {
  documents: Document[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function getDocuments(
  documentTypeId: string,
  options: GetDocumentsOptions = {},
): Promise<GetDocumentsResult> {
  // Check document list permissions
  const permissionCheck = await checkDocumentPermissions(['list'])
  if (!permissionCheck.success) {
    console.error('Permission denied for listing documents:', permissionCheck.error)
    return { documents: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }
  }

  const { page = 1, pageSize = 50, status = 'all', search } = options

  try {
    // Build where conditions
    const conditions = [eq(document.documentTypeId, documentTypeId)]

    // Handle status filtering
    if (status && status !== 'all') {
      // Check if status contains comma-separated values
      const statuses = status.includes(',') ? status.split(',') : [status]

      if (statuses.length === 1) {
        conditions.push(eq(document.status, statuses[0] as any))
      } else if (statuses.length > 1) {
        // Use OR condition for multiple statuses
        conditions.push(
          or(...statuses.map(s => eq(document.status, s as any)))!
        )
      }
    }

    // Handle search filtering
    if (search && search.trim()) {
      conditions.push(like(document.filename, `%${search.trim()}%`))
    }

    // Get total count for pagination
    const countResult = await db
      .select({ count: count() })
      .from(document)
      .where(and(...conditions))

    const total = Number(countResult[0]?.count || 0)
    const totalPages = Math.ceil(total / pageSize)

    // Get paginated documents
    const documents = await db
      .select()
      .from(document)
      .where(and(...conditions))
      .orderBy(desc(document.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)

    return {
      documents,
      total,
      page,
      pageSize,
      totalPages,
    }
  } catch (error) {
    console.error('Failed to get documents:', error)
    return { documents: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }
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
    const status = formData.get('status') as 'pending' | 'processed' | 'approved' | 'rejected'
    const schemaSnapshotString = formData.get('schemaSnapshot') as string
    const rejectionReason = formData.get('rejectionReason') as string | null

    let extractedData = undefined
    let schemaSnapshot = undefined

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

    // Use core function for database update
    const { updateDocumentCore } = await import('@/lib/db/document-operations')
    const result = await updateDocumentCore(id, {
      extractedData,
      schemaSnapshot,
      status,
      rejectionReason,
    })

    // Revalidate path for Next.js cache
    const [docType] = await db
      .select()
      .from(documentType)
      .where(eq(documentType.id, result.documentTypeId))

    if (docType) {
      revalidatePath(`/process/${docType.id}`)
    }

    return result
  } catch (error) {
    console.error('Failed to update document:', error)
    throw error
  }
}

export async function bulkUpdateDocumentStatus(
  documentIds: string[],
  status: 'pending' | 'processed' | 'approved',
) {
  // Check document update permissions
  const permissionCheck = await checkDocumentPermissions(['update'])
  if (!permissionCheck.success) {
    throw new Error(permissionCheck.error)
  }

  try {
    const results = []
    const documentTypeIds = new Set<string>()

    for (const id of documentIds) {
      // Get current document to check previous status
      const [currentDoc] = await db.select().from(document).where(eq(document.id, id))
      if (!currentDoc) {
        continue
      }

      documentTypeIds.add(currentDoc.documentTypeId)

      const [result] = await db
        .update(document)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(document.id, id))
        .returning()

      if (!result) {
        continue
      }

      results.push(result)

      // Get document type for webhook
      const [docType] = await db
        .select()
        .from(documentType)
        .where(eq(documentType.id, result.documentTypeId))

      // Trigger appropriate webhook based on status change
      if (status !== currentDoc.status && docType) {
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
    }

    // Revalidate all affected document type paths
    for (const docTypeId of documentTypeIds) {
      revalidatePath(`/process/${docTypeId}`)
    }

    return results
  } catch (error) {
    console.error('Failed to bulk update document status:', error)
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
