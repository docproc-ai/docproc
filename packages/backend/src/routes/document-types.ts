import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  createDocument,
  getDocumentsByType,
} from '../lib/db/document-operations'
import {
  createDocumentType,
  deleteDocumentType,
  getDocumentTypeBySlugOrId,
  getDocumentTypes,
  updateDocumentType,
} from '../lib/db/document-type-operations'
import { createBatch } from '../lib/db/job-operations'
import {
  requireApiKeyOrAuth,
  requireAuth,
  requirePermission,
} from '../middleware/auth'
import {
  createDocumentTypeRequest,
  updateDocumentTypeRequest,
} from '../schemas'
import { storage } from '../storage'
import { processBatchInBackground } from './processing'

// Shared schemas
const slugOrIdParam = z.object({
  slugOrId: z
    .string()
    .min(1)
    .openapi({ description: 'Document type slug or UUID' }),
})

const errorResponse = z.object({
  error: z.string(),
})

const documentTypeResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  schema: z.any().openapi({ type: 'object' }),
  validationInstructions: z.string().nullish(),
  modelName: z.string().nullish(),
  slugPattern: z.string().nullish(),
  webhookConfig: z.any().openapi({ type: 'object' }).nullish(),
  createdAt: z.any(),
  updatedAt: z.any(),
})

const documentTypeWithCountsResponse = documentTypeResponse.extend({
  documentCount: z.number(),
  statusCounts: z.object({
    pending: z.number(),
    processed: z.number(),
    approved: z.number(),
    rejected: z.number(),
  }),
})

// Route definitions
const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Document Types'],
  summary: 'List all document types',
  middleware: [
    requireApiKeyOrAuth,
    requirePermission('documentType', 'list'),
  ] as const,
  responses: {
    200: {
      description: 'List of document types with document counts',
      content: {
        'application/json': { schema: z.array(documentTypeWithCountsResponse) },
      },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
})

const createRoute_ = createRoute({
  method: 'post',
  path: '/',
  tags: ['Document Types'],
  summary: 'Create a new document type',
  middleware: [
    requireAuth,
    requirePermission('documentType', 'create'),
  ] as const,
  request: {
    body: {
      content: { 'application/json': { schema: createDocumentTypeRequest } },
    },
  },
  responses: {
    201: {
      description: 'Created document type',
      content: { 'application/json': { schema: documentTypeResponse } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
})

const getRoute = createRoute({
  method: 'get',
  path: '/{slugOrId}',
  tags: ['Document Types'],
  summary: 'Get a document type by slug or ID',
  middleware: [
    requireApiKeyOrAuth,
    requirePermission('documentType', 'list'),
  ] as const,
  request: {
    params: slugOrIdParam,
  },
  responses: {
    200: {
      description: 'Document type details',
      content: { 'application/json': { schema: documentTypeResponse } },
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
  path: '/{slugOrId}',
  tags: ['Document Types'],
  summary: 'Update a document type',
  middleware: [
    requireAuth,
    requirePermission('documentType', 'update'),
  ] as const,
  request: {
    params: slugOrIdParam,
    body: {
      content: { 'application/json': { schema: updateDocumentTypeRequest } },
    },
  },
  responses: {
    200: {
      description: 'Updated document type',
      content: { 'application/json': { schema: documentTypeResponse } },
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
  path: '/{slugOrId}',
  tags: ['Document Types'],
  summary: 'Delete a document type',
  middleware: [
    requireAuth,
    requirePermission('documentType', 'delete'),
  ] as const,
  request: {
    params: slugOrIdParam,
  },
  responses: {
    200: {
      description: 'Deletion successful',
      content: {
        'application/json': { schema: z.object({ success: z.boolean() }) },
      },
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

const uploadRoute = createRoute({
  method: 'post',
  path: '/{slugOrId}/upload',
  tags: ['Document Types'],
  summary: 'Upload documents to a document type',
  description:
    'Upload one or more files. Use autoProcess=true to automatically queue processing.',
  middleware: [
    requireApiKeyOrAuth,
    requirePermission('document', 'create'),
  ] as const,
  request: {
    params: slugOrIdParam,
    query: z.object({
      autoProcess: z
        .string()
        .optional()
        .openapi({ description: 'Set to "true" to auto-process uploads' }),
      model: z
        .string()
        .optional()
        .openapi({ description: 'Override AI model for processing' }),
    }),
    // Note: Body validation removed - zod-openapi validator consumes the stream
    // before the handler can read it, causing status 0 errors in Bun
  },
  responses: {
    200: {
      description: 'Upload results',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            documentTypeId: z.string().uuid(),
            documentTypeSlug: z.string(),
            results: z.array(
              z.object({
                filename: z.string(),
                success: z.boolean(),
                documentId: z.string().uuid().optional(),
                error: z.string().optional(),
              }),
            ),
            jobIds: z.array(z.string()).optional(),
            batchId: z.string().optional(),
            summary: z.object({
              total: z.number(),
              uploaded: z.number(),
              failed: z.number(),
            }),
          }),
        },
      },
    },
    400: {
      description: 'Bad request',
      content: { 'application/json': { schema: errorResponse } },
    },
    404: {
      description: 'Document type not found',
      content: { 'application/json': { schema: errorResponse } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: errorResponse } },
    },
  },
})

// Create router and register routes
export const documentTypesRoutes = new OpenAPIHono()

  .openapi(listRoute, async (c) => {
    try {
      const types = await getDocumentTypes()
      return c.json(types, 200)
    } catch (error) {
      console.error('Failed to get document types:', error)
      return c.json({ error: 'Failed to get document types' }, 500)
    }
  })

  .openapi(createRoute_, async (c) => {
    try {
      const data = c.req.valid('json')
      const user = c.get('user')

      const result = await createDocumentType({
        name: data.name,
        schema: data.schema as Record<string, unknown>,
        validationInstructions: data.validationInstructions,
        modelName: data.modelName,
        slugPattern: data.slugPattern,
        webhookConfig: data.webhookConfig as
          | Record<string, unknown>
          | undefined,
        createdBy: user?.id,
      })

      return c.json(result, 201)
    } catch (error) {
      console.error('Failed to create document type:', error)
      return c.json({ error: 'Failed to create document type' }, 500)
    }
  })

  .openapi(getRoute, async (c) => {
    try {
      const { slugOrId } = c.req.valid('param')
      const result = await getDocumentTypeBySlugOrId(slugOrId)

      if (!result) {
        return c.json({ error: 'Document type not found' }, 404)
      }

      return c.json(result, 200)
    } catch (error) {
      console.error('Failed to get document type:', error)
      return c.json({ error: 'Failed to get document type' }, 500)
    }
  })

  .openapi(updateRoute, async (c) => {
    try {
      const { slugOrId } = c.req.valid('param')
      const data = c.req.valid('json')
      const user = c.get('user')

      const docType = await getDocumentTypeBySlugOrId(slugOrId)
      if (!docType) {
        return c.json({ error: 'Document type not found' }, 404)
      }

      const result = await updateDocumentType(docType.id, {
        name: data.name,
        schema: data.schema as Record<string, unknown> | undefined,
        validationInstructions: data.validationInstructions,
        modelName: data.modelName,
        slugPattern: data.slugPattern,
        webhookConfig: data.webhookConfig as
          | Record<string, unknown>
          | undefined,
        updatedBy: user?.id,
      })

      if (!result) {
        return c.json({ error: 'Document type not found' }, 404)
      }

      return c.json(result, 200)
    } catch (error) {
      console.error('Failed to update document type:', error)
      return c.json({ error: 'Failed to update document type' }, 500)
    }
  })

  .openapi(deleteRoute, async (c) => {
    try {
      const { slugOrId } = c.req.valid('param')

      const docType = await getDocumentTypeBySlugOrId(slugOrId)
      if (!docType) {
        return c.json({ error: 'Document type not found' }, 404)
      }

      const documents = await getDocumentsByType(docType.id)

      for (const doc of documents) {
        try {
          await storage.delete(doc.storagePath)
        } catch (err) {
          console.error(`Failed to delete file for document ${doc.id}:`, err)
        }
      }

      await deleteDocumentType(docType.id)

      return c.json({ success: true }, 200)
    } catch (error) {
      console.error('Failed to delete document type:', error)
      return c.json({ error: 'Failed to delete document type' }, 500)
    }
  })

  .openapi(uploadRoute, async (c) => {
    try {
      const { slugOrId } = c.req.valid('param')
      const { autoProcess: autoProcessStr, model: overrideModel } =
        c.req.valid('query')
      const user = c.get('user')

      const docType = await getDocumentTypeBySlugOrId(slugOrId)
      if (!docType) {
        return c.json({ error: 'Document type not found' }, 404)
      }

      const autoProcess = autoProcessStr === 'true'

      const formData = await c.req.formData()
      const files = formData.getAll('files') as File[]

      const singleFile = formData.get('file') as File | null
      if (singleFile && files.length === 0) {
        files.push(singleFile)
      }

      if (files.length === 0) {
        return c.json({ error: 'No files provided' }, 400)
      }

      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/tiff',
      ]

      const extToMime: Record<string, string> = {
        pdf: 'application/pdf',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        tiff: 'image/tiff',
        tif: 'image/tiff',
      }

      const results: Array<{
        filename: string
        success: boolean
        documentId?: string
        error?: string
      }> = []

      for (const file of files) {
        try {
          const ext = file.name.split('.').pop()?.toLowerCase() || ''
          const mimeType = file.type || extToMime[ext] || ''

          if (!allowedTypes.includes(mimeType)) {
            results.push({
              filename: file.name,
              success: false,
              error: `Unsupported file type: ${mimeType || 'unknown'}`,
            })
            continue
          }

          const buffer = Buffer.from(await file.arrayBuffer())

          const storageKey = await storage.upload(buffer, file.name, mimeType)

          const document = await createDocument({
            documentTypeId: docType.id,
            filename: file.name,
            storagePath: storageKey,
            createdBy: user?.id,
          })

          results.push({
            filename: file.name,
            success: true,
            documentId: document.id,
          })
        } catch (error) {
          console.error('Failed to upload file:', file.name, error)
          results.push({
            filename: file.name,
            success: false,
            error: error instanceof Error ? error.message : 'Upload failed',
          })
        }
      }

      const successful = results.filter((r) => r.success).length
      const failed = results.filter((r) => !r.success).length

      const uploadedDocumentIds = results
        .filter((r) => r.success && r.documentId)
        .map((r) => r.documentId as string)

      let jobIds: string[] = []
      let batchId: string | undefined

      if (autoProcess && uploadedDocumentIds.length > 0) {
        try {
          const { batch, jobs } = await createBatch({
            documentTypeId: docType.id,
            documentIds: uploadedDocumentIds,
            createdBy: user?.id,
          })

          jobIds = jobs.map((j) => j.id)
          batchId = batch.id

          processBatchInBackground(
            batch.id,
            docType.id,
            uploadedDocumentIds,
            undefined,
            undefined,
            overrideModel,
          )
        } catch (processError) {
          console.error('Failed to queue processing jobs:', processError)
        }
      }

      return c.json(
        {
          success: true,
          documentTypeId: docType.id,
          documentTypeSlug: docType.slug,
          results,
          ...(autoProcess && jobIds.length > 0 ? { jobIds, batchId } : {}),
          summary: {
            total: files.length,
            uploaded: successful,
            failed,
          },
        },
        200,
      )
    } catch (error) {
      console.error('Upload API error:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })
