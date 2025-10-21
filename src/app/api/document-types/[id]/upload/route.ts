import { NextRequest, NextResponse } from 'next/server'
import { getDocumentType } from '@/lib/actions/document-type'
import { createDocument } from '@/lib/actions/document'
import { checkDocumentPermissions } from '@/lib/auth-utils'
import { checkApiAuth } from '@/lib/api-auth'
import { checkAIRateLimit } from '@/lib/ai-rate-limit'
import { queueDocumentProcessing } from '@/lib/jobs/submission'

/**
 * Upload and optionally auto-process documents
 *
 * POST /api/document-types/{id}/upload?autoProcess=true&model=claude-3-5-sonnet-20241022
 *
 * This is the RECOMMENDED endpoint for automated document processing workflows.
 *
 * Features:
 * - Upload single or multiple files (multipart/form-data)
 * - Optional auto-processing via BullMQ queue (set autoProcess=true)
 * - Returns immediately with job IDs for async processing
 * - Optimized for high-volume automation and batch uploads
 * - Check job status with: GET /api/jobs/status?jobIds=...
 *
 * Query Parameters:
 * - autoProcess: Set to 'true' to automatically queue processing jobs
 * - model: (Admin/API key only) Override the AI model for processing
 *
 * Form Data:
 * - files: One or more File objects to upload
 * - file: Alternative single file field (for backward compatibility)
 *
 * Response (with autoProcess=true):
 * {
 *   success: true,
 *   documentTypeId: string,
 *   results: Array<{ filename, success, documentId }>,
 *   jobIds: string[],        // Use these to check job status
 *   batchId: string,         // Shared ID for all jobs in this batch
 *   summary: { total, uploaded, failed }
 * }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check if user has permission to create documents (or has valid API key)
    const authCheck = await checkApiAuth({
      document: ['create'],
    })

    if (!authCheck.success) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const documentTypeId = id

    // Check if document type exists
    const docType = await getDocumentType(documentTypeId)
    if (!docType) {
      return NextResponse.json({ error: 'Document type not found' }, { status: 404 })
    }

    // Get autoProcess flag from query params
    const { searchParams } = new URL(request.url)
    const autoProcess = searchParams.get('autoProcess') === 'true'
    let overrideModel = searchParams.get('model')

    // Validate admin privileges for model override
    if (overrideModel && !authCheck.isApiKey) {
      const permissionCheck = await checkDocumentPermissions(['update'])
      if (!permissionCheck.success) {
        // Non-admin users cannot override models - ignore the parameter
        overrideModel = null
        console.warn('Non-admin user attempted to override model, ignoring parameter')
      }
    }

    // Parse form data
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    // Also check for single file uploads
    const singleFile = formData.get('file') as File
    if (singleFile && files.length === 0) {
      files.push(singleFile)
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // Check AI rate limit if auto-processing is enabled
    if (autoProcess) {
      try {
        await checkAIRateLimit('upload-auto-process');
      } catch (error) {
        return NextResponse.json({ 
          error: error instanceof Error ? error.message : 'Rate limit exceeded for auto-processing' 
        }, { status: 429 });
      }
    }

    const results = []
    const uploadedDocumentIds: string[] = []

    // Process each file
    for (const file of files) {
      try {
        // Create document
        const uploadFormData = new FormData()
        uploadFormData.append('file', file)
        uploadFormData.append('documentTypeId', documentTypeId)

        const document = await createDocument(uploadFormData)

        results.push({
          filename: file.name,
          success: true,
          documentId: document.id,
        })

        uploadedDocumentIds.push(document.id)
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

    // Auto-process if requested (using BullMQ)
    let jobIds: string[] = []
    let batchId: string | undefined

    if (autoProcess && uploadedDocumentIds.length > 0) {
      try {
        // Get user info from session
        const userId = authCheck.session?.user?.id || 'api-user'
        const userName = authCheck.session?.user?.name || authCheck.session?.user?.email || 'API User'

        // Queue all uploaded documents for processing
        // Use non-streaming mode for upload API (efficient for automation/high-volume)
        const queueResult = await queueDocumentProcessing({
          documentIds: uploadedDocumentIds,
          documentTypeId,
          schema: docType.schema,
          userId,
          userName,
          overrideModel: overrideModel || undefined,
          // enableStreaming defaults to false - optimal for automation
        })

        jobIds = queueResult.jobIds
        batchId = queueResult.batchId
      } catch (processError) {
        console.error('Failed to queue processing jobs:', processError)
        // Don't fail the upload if processing queue submission fails
      }
    }

    return NextResponse.json({
      success: true,
      documentTypeId,
      results,
      ...(autoProcess && jobIds.length > 0 ? { jobIds, batchId } : {}),
      summary: {
        total: files.length,
        uploaded: successful,
        failed,
      },
    })
  } catch (error) {
    console.error('Upload API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
