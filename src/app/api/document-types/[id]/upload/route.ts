import { NextRequest, NextResponse } from 'next/server'
import { getDocumentType } from '@/lib/actions/document-type'
import { createDocument } from '@/lib/actions/document'
import { processDocument } from '@/lib/actions/process'
import { checkDocumentPermissions } from '@/lib/auth-utils'
import { checkApiAuth } from '@/lib/api-auth'
import { checkAIRateLimit } from '@/lib/ai-rate-limit'

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
    if (overrideModel) {
      const permissionCheck = await checkDocumentPermissions(['update'])
      if (!permissionCheck.success) {
        // Non-admin users cannot override models - ignore the parameter
        overrideModel = null
        console.warn('Non-admin user attempted to override model, ignoring parameter')
      }
    }

    // Parse form data
    const formData = await request.formData()
    const files = formData.getAll('files[]') as File[]

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

    // Process each file
    for (const file of files) {
      try {
        // Create document
        const uploadFormData = new FormData()
        uploadFormData.append('file', file)
        uploadFormData.append('documentTypeId', documentTypeId)

        const document = await createDocument(uploadFormData)

        const result = {
          filename: file.name,
          success: true,
          documentId: document.id,
        }

        // Auto-process if requested
        if (autoProcess) {
          try {
            const processFormData = new FormData()
            processFormData.append('documentId', document.id)
            processFormData.append('documentTypeId', documentTypeId)
            processFormData.append('schema', JSON.stringify(docType.schema))
            if (overrideModel) {
              processFormData.append('model', overrideModel)
            }

            // Trigger processing (this will happen in background)
            await processDocument(processFormData)

            // Note: We don't wait for processing to complete or return extracted data
            // The processing happens asynchronously and users can check results later
          } catch (processError) {
            console.error('Processing failed for document:', document.id, processError)
            // Don't fail the upload if processing fails
          }
        }

        results.push(result)
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

    return NextResponse.json({
      success: true,
      documentTypeId,
      results,
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
