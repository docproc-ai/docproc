import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import sharp from 'sharp'
import { PDFDocument, degrees } from 'pdf-lib'
import {
  getDocumentsQuery,
  updateDocumentRequest,
  bulkStatusUpdateRequest,
  bulkDeleteRequest,
} from '../schemas'
import {
  getDocuments,
  getDocument,
  getDocumentBySlugOrId,
  updateDocument,
  deleteDocument,
  bulkUpdateDocumentStatus,
  bulkDeleteDocuments,
} from '../lib/db/document-operations'
import { storage } from '../storage'
import {
  requireApiKeyOrAuth,
  requireAuth,
  requirePermission,
} from '../middleware/auth'

// Use basePath for proper RPC type inference
export const documentsRoutes = new Hono()
  .basePath('/api/documents')

  // GET /api/documents - List with pagination
  .get(
    '/',
    requireApiKeyOrAuth,
    zValidator('query', getDocumentsQuery),
    async (c) => {
      try {
        const { documentTypeId, page, pageSize, status, search } = c.req.valid('query')

        const result = await getDocuments(documentTypeId, {
          page,
          pageSize,
          status,
          search,
        })

        return c.json({
          documents: result.documents,
          pagination: {
            page: result.page,
            pageSize: result.pageSize,
            total: result.total,
            totalPages: result.totalPages,
          },
        }, 200)
      } catch (error) {
        console.error('Failed to get documents:', error)
        return c.json({ error: 'Failed to get documents' }, 500)
      }
    },
  )

  // POST /api/documents/bulk-status - Bulk update status (before /:id to avoid route conflict)
  .post(
    '/bulk-status',
    requireAuth,
    requirePermission('document', 'update'),
    zValidator('json', bulkStatusUpdateRequest),
    async (c) => {
      try {
        const { documentIds, status } = c.req.valid('json')
        const user = c.get('user')

        const count = await bulkUpdateDocumentStatus(documentIds, status, user?.id)

        return c.json({ success: true, updated: count }, 200)
      } catch (error) {
        console.error('Failed to bulk update status:', error)
        return c.json({ error: 'Failed to bulk update status' }, 500)
      }
    },
  )

  // POST /api/documents/bulk-delete - Bulk delete (before /:id to avoid route conflict)
  .post(
    '/bulk-delete',
    requireAuth,
    requirePermission('document', 'delete'),
    zValidator('json', bulkDeleteRequest),
    async (c) => {
      try {
        const { documentIds } = c.req.valid('json')

        // Get documents to delete their files
        for (const id of documentIds) {
          const doc = await getDocument(id)
          if (doc) {
            try {
              await storage.delete(doc.storagePath)
            } catch (err) {
              console.error(`Failed to delete file for document ${id}:`, err)
            }
          }
        }

        const count = await bulkDeleteDocuments(documentIds)

        return c.json({ success: true, deleted: count }, 200)
      } catch (error) {
        console.error('Failed to bulk delete:', error)
        return c.json({ error: 'Failed to bulk delete' }, 500)
      }
    },
  )

  // POST /api/documents/:id/rotate - Rotate document (before /:id to ensure proper matching)
  .post(
    '/:id/rotate',
    requireAuth,
    requirePermission('document', 'update'),
    zValidator('param', z.object({ id: z.string().min(1) })),
    zValidator('json', z.object({
      degrees: z.number().multipleOf(90),
      pageNumber: z.number().int().positive().optional(), // Optional: for single-page PDF rotation
    })),
    async (c) => {
      try {
        const { id } = c.req.valid('param')
        const { degrees: rotationDegrees, pageNumber } = c.req.valid('json')

        const doc = await getDocumentBySlugOrId(id)
        if (!doc) {
          return c.json({ error: 'Document not found' }, 404)
        }

        // Download the current file
        const { buffer: fileBuffer, mimeType } = await storage.download(doc.storagePath)

        let rotatedBuffer: Buffer
        const fileExtension = doc.filename.toLowerCase().split('.').pop()

        if (mimeType === 'application/pdf' || fileExtension === 'pdf') {
          // Handle PDF rotation
          const pdfDoc = await PDFDocument.load(fileBuffer)
          const pages = pdfDoc.getPages()

          if (pageNumber !== undefined) {
            // Single page rotation
            if (pageNumber < 1 || pageNumber > pages.length) {
              return c.json({ error: 'Invalid page number' }, 400)
            }
            const page = pages[pageNumber - 1] // 1-indexed to 0-indexed
            const currentRotation = page.getRotation().angle || 0
            page.setRotation(degrees(currentRotation + rotationDegrees))
          } else {
            // Apply relative rotation to all pages
            for (const page of pages) {
              const currentRotation = page.getRotation().angle || 0
              page.setRotation(degrees(currentRotation + rotationDegrees))
            }
          }

          rotatedBuffer = Buffer.from(await pdfDoc.save())
        } else if (['jpg', 'jpeg', 'png', 'webp', 'tiff', 'bmp', 'gif'].includes(fileExtension || '')) {
          // Handle image rotation using Sharp
          rotatedBuffer = await sharp(fileBuffer).rotate(rotationDegrees).toBuffer()
        } else {
          return c.json({ error: 'Unsupported file type for rotation' }, 400)
        }

        // Write the rotated file back to storage
        await storage.save(doc.storagePath, rotatedBuffer)

        return c.json({ success: true }, 200)
      } catch (error) {
        console.error('Failed to rotate document:', error)
        return c.json({ error: 'Failed to rotate document' }, 500)
      }
    },
  )

  // GET /api/documents/:id - Get one (supports both slug and UUID)
  .get(
    '/:id',
    requireApiKeyOrAuth,
    zValidator('param', z.object({ id: z.string().min(1) })),
    async (c) => {
      try {
        const { id } = c.req.valid('param')
        const result = await getDocumentBySlugOrId(id)

        if (!result) {
          return c.json({ error: 'Document not found' }, 404)
        }

        return c.json(result, 200)
      } catch (error) {
        console.error('Failed to get document:', error)
        return c.json({ error: 'Failed to get document' }, 500)
      }
    },
  )

  // PUT /api/documents/:id - Update (supports both slug and UUID)
  .put(
    '/:id',
    requireAuth,
    requirePermission('document', 'update'),
    zValidator('param', z.object({ id: z.string().min(1) })),
    zValidator('json', updateDocumentRequest),
    async (c) => {
      try {
        const { id } = c.req.valid('param')
        const data = c.req.valid('json')
        const user = c.get('user')

        // Resolve slug to actual document ID
        const doc = await getDocumentBySlugOrId(id)
        if (!doc) {
          return c.json({ error: 'Document not found' }, 404)
        }

        const result = await updateDocument(doc.id, {
          extractedData: data.extractedData as Record<string, unknown> | undefined,
          schemaSnapshot: data.schemaSnapshot as Record<string, unknown> | undefined,
          status: data.status,
          rejectionReason: data.rejectionReason,
          updatedBy: user?.id,
        })

        if (!result) {
          return c.json({ error: 'Document not found' }, 404)
        }

        return c.json(result, 200)
      } catch (error) {
        console.error('Failed to update document:', error)
        return c.json({ error: 'Failed to update document' }, 500)
      }
    },
  )

  // DELETE /api/documents/:id - Delete (supports both slug and UUID)
  .delete(
    '/:id',
    requireAuth,
    requirePermission('document', 'delete'),
    zValidator('param', z.object({ id: z.string().min(1) })),
    async (c) => {
      try {
        const { id } = c.req.valid('param')
        const doc = await getDocumentBySlugOrId(id)

        if (!doc) {
          return c.json({ error: 'Document not found' }, 404)
        }

        // Delete file from storage
        try {
          await storage.delete(doc.storagePath)
        } catch (err) {
          console.error(`Failed to delete file for document ${doc.id}:`, err)
        }

        // Delete document from database
        await deleteDocument(doc.id)

        return c.json({ success: true }, 200)
      } catch (error) {
        console.error('Failed to delete document:', error)
        return c.json({ error: 'Failed to delete document' }, 500)
      }
    },
  )

  // GET /api/documents/:id/file - Download file (supports both slug and UUID)
  .get(
    '/:id/file',
    requireApiKeyOrAuth,
    zValidator('param', z.object({ id: z.string().min(1) })),
    async (c) => {
      try {
        const { id } = c.req.valid('param')
        const doc = await getDocumentBySlugOrId(id)

        if (!doc) {
          return c.json({ error: 'Document not found' }, 404)
        }

        // Download from storage
        const { buffer, mimeType } = await storage.download(doc.storagePath)

        return new Response(new Uint8Array(buffer), {
          headers: {
            'Content-Type': mimeType,
            'Content-Disposition': `inline; filename="${doc.filename}"`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        })
      } catch (error) {
        console.error('Failed to download file:', error)
        return c.json({ error: 'Failed to download file' }, 500)
      }
    },
  )
