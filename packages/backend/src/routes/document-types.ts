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
import { createBatch } from '../lib/db/job-operations'
import { processBatchInBackground } from './processing'

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

        // Get autoProcess flag and model override from query params
        const autoProcess = c.req.query('autoProcess') === 'true'
        const overrideModel = c.req.query('model') || undefined

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

        // Allowed MIME types and extension-to-MIME mapping
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

        // Process each file
        for (const file of files) {
          try {
            // Get MIME type from file or infer from extension
            const ext = file.name.split('.').pop()?.toLowerCase() || ''
            const mimeType = file.type || extToMime[ext] || ''

            // Validate file type
            if (!allowedTypes.includes(mimeType)) {
              results.push({
                filename: file.name,
                success: false,
                error: `Unsupported file type: ${mimeType || 'unknown'}`,
              })
              continue
            }

            // Read file buffer
            const buffer = Buffer.from(await file.arrayBuffer())

            // Upload to storage
            const storageKey = await storage.upload(
              buffer,
              file.name,
              mimeType,
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

        // Get successfully uploaded document IDs
        const uploadedDocumentIds = results
          .filter((r) => r.success && r.documentId)
          .map((r) => r.documentId as string)

        // Auto-process if requested
        let jobIds: string[] = []
        let batchId: string | undefined

        if (autoProcess && uploadedDocumentIds.length > 0) {
          try {
            // Create batch and jobs
            const { batch, jobs } = await createBatch({
              documentTypeId: docType.id,
              documentIds: uploadedDocumentIds,
              createdBy: user?.id,
            })

            jobIds = jobs.map((j) => j.id)
            batchId = batch.id

            // Start processing in background (don't await)
            processBatchInBackground(
              batch.id,
              docType.id,
              uploadedDocumentIds,
              undefined, // webhookUrl
              undefined, // concurrency (use default)
              overrideModel,
            )
          } catch (processError) {
            console.error('Failed to queue processing jobs:', processError)
            // Don't fail the upload if processing queue submission fails
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
    },
  )
