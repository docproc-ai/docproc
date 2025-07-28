import { NextRequest, NextResponse } from 'next/server'
import { getDocumentType } from '@/lib/actions/document-type'
import { createDocument, processDocument } from '@/lib/actions/document'
import { DEFAULT_MODEL } from '@/lib/models/anthropic'
import { validateAdminUser } from '@/lib/auth-utils'

/**
 * Get the model to use for processing a document type
 * Priority: overrideModel > documentType.modelName > system default
 */
async function getModelForProcessing(
  documentTypeId: number,
  overrideModel?: string,
): Promise<string> {
  if (overrideModel) {
    return overrideModel
  }

  const docType = await getDocumentType(documentTypeId)
  if (docType?.modelName) {
    return docType.modelName
  }

  // System default
  return DEFAULT_MODEL
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const documentTypeId = parseInt(id)

    if (isNaN(documentTypeId)) {
      return NextResponse.json({ error: 'Invalid document type ID' }, { status: 400 })
    }

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
      const adminSession = await validateAdminUser()
      if (!adminSession) {
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

    const results = []

    // Process each file
    for (const file of files) {
      try {
        // Create document
        const uploadFormData = new FormData()
        uploadFormData.append('file', file)
        uploadFormData.append('documentTypeId', documentTypeId.toString())

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
            processFormData.append('documentId', document.id.toString())
            processFormData.append('documentTypeId', documentTypeId.toString())
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
