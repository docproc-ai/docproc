import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { degrees, PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import {
  bulkDeleteDocuments,
  bulkUpdateDocumentStatus,
  deleteDocument,
  getDocument,
  getDocumentBySlugOrId,
  getDocuments,
  updateDocument,
} from '../lib/db/document-operations'
import {
  requireApiKeyOrAuth,
  requireAuth,
  requirePermission,
} from '../middleware/auth'
import {
  bulkDeleteRequest,
  bulkStatusUpdateRequest,
  getDocumentsQuery,
  updateDocumentRequest,
} from '../schemas'
import { storage } from '../storage'

// Shared schemas
const idParam = z.object({
  id: z.string().min(1).openapi({ description: 'Document ID or slug' }),
})
const errorResponse = z.object({ error: z.string() })
const successResponse = z.object({ success: z.boolean() })

// Document response schema
const documentResponse = z.object({
  id: z.string().uuid(),
  documentTypeId: z.string().uuid(),
  status: z.enum(['pending', 'processed', 'approved', 'rejected']).nullable(),
  filename: z.string(),
  storagePath: z.string(),
  slug: z.string().nullable(),
  extractedData: z.any().openapi({ type: 'object' }).nullable(),
  schemaSnapshot: z.any().openapi({ type: 'object' }).nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: z.any(),
  updatedAt: z.any(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
})

// Route definitions
const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Documents'],
  summary: 'List documents with pagination',
  middleware: [
    requireApiKeyOrAuth,
    requirePermission('document', 'list'),
  ] as const,
  request: {
    query: getDocumentsQuery,
  },
  responses: {
    200: {
      description: 'Paginated list of documents',
      content: {
        'application/json': {
          schema: z.object({
            documents: z.array(documentResponse),
            pagination: z.object({
              page: z.number(),
              pageSize: z.number(),
              total: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
})

const bulkStatusRoute = createRoute({
  method: 'post',
  path: '/bulk-status',
  tags: ['Documents'],
  summary: 'Bulk update document status',
  middleware: [requireAuth, requirePermission('document', 'update')] as const,
  request: {
    body: {
      content: { 'application/json': { schema: bulkStatusUpdateRequest } },
    },
  },
  responses: {
    200: {
      description: 'Status updated',
      content: {
        'application/json': {
          schema: z.object({ success: z.boolean(), updated: z.number() }),
        },
      },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
})

const bulkDeleteRoute = createRoute({
  method: 'post',
  path: '/bulk-delete',
  tags: ['Documents'],
  summary: 'Bulk delete documents',
  middleware: [requireAuth, requirePermission('document', 'delete')] as const,
  request: {
    body: { content: { 'application/json': { schema: bulkDeleteRequest } } },
  },
  responses: {
    200: {
      description: 'Documents deleted',
      content: {
        'application/json': {
          schema: z.object({ success: z.boolean(), deleted: z.number() }),
        },
      },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
})

const rotateRoute = createRoute({
  method: 'post',
  path: '/{id}/rotate',
  tags: ['Documents'],
  summary: 'Rotate a document',
  middleware: [requireAuth, requirePermission('document', 'update')] as const,
  request: {
    params: idParam,
    body: {
      content: {
        'application/json': {
          schema: z.object({
            degrees: z.number().multipleOf(90).openapi({
              description: 'Rotation in degrees (must be multiple of 90)',
            }),
            pageNumber: z.number().int().positive().optional().openapi({
              description: 'Page number for single-page PDF rotation',
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Document rotated',
      content: { 'application/json': { schema: successResponse } },
    },
    400: {
      description: 'Bad request',
      content: { 'application/json': { schema: errorResponse } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: errorResponse } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
})

const getRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Documents'],
  summary: 'Get a document by ID or slug',
  middleware: [
    requireApiKeyOrAuth,
    requirePermission('document', 'list'),
  ] as const,
  request: { params: idParam },
  responses: {
    200: {
      description: 'Document details',
      content: { 'application/json': { schema: documentResponse } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: errorResponse } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
})

const updateRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Documents'],
  summary: 'Update a document',
  middleware: [requireAuth, requirePermission('document', 'update')] as const,
  request: {
    params: idParam,
    body: {
      content: { 'application/json': { schema: updateDocumentRequest } },
    },
  },
  responses: {
    200: {
      description: 'Updated document',
      content: { 'application/json': { schema: documentResponse } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: errorResponse } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Documents'],
  summary: 'Delete a document',
  middleware: [requireAuth, requirePermission('document', 'delete')] as const,
  request: { params: idParam },
  responses: {
    200: {
      description: 'Deleted',
      content: { 'application/json': { schema: successResponse } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: errorResponse } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
})

const fileRoute = createRoute({
  method: 'get',
  path: '/{id}/file',
  tags: ['Documents'],
  summary: 'Download document file',
  middleware: [
    requireApiKeyOrAuth,
    requirePermission('document', 'list'),
  ] as const,
  request: { params: idParam },
  responses: {
    200: { description: 'File content' },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: errorResponse } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
})

// Create router and register routes
export const documentsRoutes = new OpenAPIHono()

  .openapi(listRoute, async (c) => {
    try {
      const { documentTypeId, page, pageSize, status, search } =
        c.req.valid('query')
      const result = await getDocuments(documentTypeId, {
        page,
        pageSize,
        status,
        search,
      })
      return c.json(
        {
          documents: result.documents,
          pagination: {
            page: result.page,
            pageSize: result.pageSize,
            total: result.total,
            totalPages: result.totalPages,
          },
        },
        200,
      )
    } catch (error) {
      console.error('Failed to get documents:', error)
      return c.json({ error: 'Failed to get documents' }, 500)
    }
  })

  .openapi(bulkStatusRoute, async (c) => {
    try {
      const { documentIds, status } = c.req.valid('json')
      const user = c.get('user')
      const count = await bulkUpdateDocumentStatus(
        documentIds,
        status,
        user?.id,
      )
      return c.json({ success: true, updated: count }, 200)
    } catch (error) {
      console.error('Failed to bulk update status:', error)
      return c.json({ error: 'Failed to bulk update status' }, 500)
    }
  })

  .openapi(bulkDeleteRoute, async (c) => {
    try {
      const { documentIds } = c.req.valid('json')
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
  })

  .openapi(rotateRoute, async (c) => {
    try {
      const { id } = c.req.valid('param')
      const { degrees: rotationDegrees, pageNumber } = c.req.valid('json')

      const doc = await getDocumentBySlugOrId(id)
      if (!doc) {
        return c.json({ error: 'Document not found' }, 404)
      }

      const { buffer: fileBuffer, mimeType } = await storage.download(
        doc.storagePath,
      )
      let rotatedBuffer: Buffer
      const fileExtension = doc.filename.toLowerCase().split('.').pop()

      if (mimeType === 'application/pdf' || fileExtension === 'pdf') {
        const pdfDoc = await PDFDocument.load(fileBuffer)
        const pages = pdfDoc.getPages()

        if (pageNumber !== undefined) {
          if (pageNumber < 1 || pageNumber > pages.length) {
            return c.json({ error: 'Invalid page number' }, 400)
          }
          const page = pages[pageNumber - 1]
          const currentRotation = page.getRotation().angle || 0
          page.setRotation(degrees(currentRotation + rotationDegrees))
        } else {
          for (const page of pages) {
            const currentRotation = page.getRotation().angle || 0
            page.setRotation(degrees(currentRotation + rotationDegrees))
          }
        }
        rotatedBuffer = Buffer.from(await pdfDoc.save())
      } else if (
        ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'bmp', 'gif'].includes(
          fileExtension || '',
        )
      ) {
        rotatedBuffer = await sharp(fileBuffer)
          .rotate(rotationDegrees)
          .toBuffer()
      } else {
        return c.json({ error: 'Unsupported file type for rotation' }, 400)
      }

      await storage.save(doc.storagePath, rotatedBuffer)
      return c.json({ success: true }, 200)
    } catch (error) {
      console.error('Failed to rotate document:', error)
      return c.json({ error: 'Failed to rotate document' }, 500)
    }
  })

  .openapi(getRoute, async (c) => {
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
  })

  .openapi(updateRoute, async (c) => {
    try {
      const { id } = c.req.valid('param')
      const data = c.req.valid('json')
      const user = c.get('user')

      const doc = await getDocumentBySlugOrId(id)
      if (!doc) {
        return c.json({ error: 'Document not found' }, 404)
      }

      const result = await updateDocument(doc.id, {
        extractedData: data.extractedData as
          | Record<string, unknown>
          | undefined,
        schemaSnapshot: data.schemaSnapshot as
          | Record<string, unknown>
          | undefined,
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
  })

  .openapi(deleteRoute, async (c) => {
    try {
      const { id } = c.req.valid('param')
      const doc = await getDocumentBySlugOrId(id)

      if (!doc) {
        return c.json({ error: 'Document not found' }, 404)
      }

      try {
        await storage.delete(doc.storagePath)
      } catch (err) {
        console.error(`Failed to delete file for document ${doc.id}:`, err)
      }

      await deleteDocument(doc.id)
      return c.json({ success: true }, 200)
    } catch (error) {
      console.error('Failed to delete document:', error)
      return c.json({ error: 'Failed to delete document' }, 500)
    }
  })

  .openapi(fileRoute, async (c) => {
    try {
      const { id } = c.req.valid('param')
      const doc = await getDocumentBySlugOrId(id)

      if (!doc) {
        return c.json({ error: 'Document not found' }, 404)
      }

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
  })
