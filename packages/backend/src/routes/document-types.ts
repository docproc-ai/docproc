import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  createDocumentTypeRequest,
  updateDocumentTypeRequest,
} from '../schemas'
import {
  getDocumentTypes,
  getDocumentTypeBySlugOrId,
  createDocumentType,
  updateDocumentType,
  deleteDocumentType,
} from '../lib/db/document-type-operations'
import {
  getDocumentsByType,
  createDocument,
} from '../lib/db/document-operations'
import { storage } from '../storage'
import {
  requireApiKeyOrAuth,
  requireAuth,
  requirePermission,
} from '../middleware/auth'

// Param validator for slug or UUID
const slugOrIdParam = z.object({ slugOrId: z.string().min(1) })

// Use basePath for proper RPC type inference
export const documentTypesRoutes = new Hono()
  .basePath('/api/document-types')

  // GET /api/document-types - List all
  .get('/', requireApiKeyOrAuth, requirePermission('documentType', 'list'), async (c) => {
    try {
      const types = await getDocumentTypes()
      return c.json(types, 200)
    } catch (error) {
      console.error('Failed to get document types:', error)
      return c.json({ error: 'Failed to get document types' }, 500)
    }
  })

  // POST /api/document-types - Create
  .post(
    '/',
    requireAuth,
    requirePermission('documentType', 'create'),
    zValidator('json', createDocumentTypeRequest),
    async (c) => {
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
    },
  )

  // GET /api/document-types/:slugOrId - Get one by slug or ID
  .get(
    '/:slugOrId',
    requireApiKeyOrAuth,
    requirePermission('documentType', 'list'),
    zValidator('param', slugOrIdParam),
    async (c) => {
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
    },
  )

  // PUT /api/document-types/:slugOrId - Update
  .put(
    '/:slugOrId',
    requireAuth,
    requirePermission('documentType', 'update'),
    zValidator('param', slugOrIdParam),
    zValidator('json', updateDocumentTypeRequest),
    async (c) => {
      try {
        const { slugOrId } = c.req.valid('param')
        const data = c.req.valid('json')
        const user = c.get('user')

        // Find by slug or ID first
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
    },
  )

  // DELETE /api/document-types/:slugOrId - Delete
  .delete(
    '/:slugOrId',
    requireAuth,
    requirePermission('documentType', 'delete'),
    zValidator('param', slugOrIdParam),
    async (c) => {
      try {
        const { slugOrId } = c.req.valid('param')

        // Find by slug or ID first
        const docType = await getDocumentTypeBySlugOrId(slugOrId)
        if (!docType) {
          return c.json({ error: 'Document type not found' }, 404)
        }

        // Get all documents to delete their files
        const documents = await getDocumentsByType(docType.id)

        // Delete files from storage
        for (const doc of documents) {
          try {
            await storage.delete(doc.storagePath)
          } catch (err) {
            console.error(`Failed to delete file for document ${doc.id}:`, err)
          }
        }

        // Delete document type and all documents
        await deleteDocumentType(docType.id)

        return c.json({ success: true }, 200)
      } catch (error) {
        console.error('Failed to delete document type:', error)
        return c.json({ error: 'Failed to delete document type' }, 500)
      }
    },
  )

  // POST /api/document-types/:slugOrId/upload - Upload files
  .post(
    '/:slugOrId/upload',
    requireApiKeyOrAuth,
    requirePermission('document', 'create'),
    zValidator('param', slugOrIdParam),
    async (c) => {
      try {
        const { slugOrId } = c.req.valid('param')
        const user = c.get('user')

        // Check if document type exists (by slug or ID)
        const docType = await getDocumentTypeBySlugOrId(slugOrId)
        if (!docType) {
          return c.json({ error: 'Document type not found' }, 404)
        }

        // Get autoProcess flag from query params
        const autoProcess = c.req.query('autoProcess') === 'true'

        // Parse form data
        const formData = await c.req.formData()
        const files = formData.getAll('files') as File[]

        // Also check for single file uploads
        const singleFile = formData.get('file') as File | null
        if (singleFile && files.length === 0) {
          files.push(singleFile)
        }

        if (files.length === 0) {
          return c.json({ error: 'No files provided' }, 400)
        }

        // Validate file types
        const allowedTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/tiff',
        ]

        const results: Array<{
          filename: string
          success: boolean
          documentId?: string
          error?: string
        }> = []

        // Process each file
        for (const file of files) {
          try {
            // Validate file type
            if (!allowedTypes.includes(file.type)) {
              results.push({
                filename: file.name,
                success: false,
                error: `Unsupported file type: ${file.type}`,
              })
              continue
            }

            // Read file buffer
            const buffer = Buffer.from(await file.arrayBuffer())

            // Upload to storage
            const storageKey = await storage.upload(
              buffer,
              file.name,
              file.type,
            )

            // Create document record
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

        // Calculate summary
        const successful = results.filter((r) => r.success).length
        const failed = results.filter((r) => !r.success).length

        // TODO: Implement auto-processing when processing engine is ready
        void autoProcess

        return c.json(
          {
            success: true,
            documentTypeId: docType.id,
            documentTypeSlug: docType.slug,
            results,
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
    },
  )
