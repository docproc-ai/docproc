import { NextRequest } from 'next/server'
import { checkApiAuth } from '@/lib/api-auth'
import { getDocument } from '@/lib/actions/document'
import { checkDocumentPermissions } from '@/lib/auth-utils'
import { queueDocumentProcessing } from '@/lib/jobs/submission'

export async function POST(req: NextRequest) {
  try {
    // Check if user has permission to process documents
    const authCheck = await checkApiAuth({
      document: ['update'],
    })

    if (!authCheck.success) {
      return new Response('Insufficient permissions', { status: 403 })
    }

    const body = await req.json()
    const {
      documentId,
      documentTypeId,
      schema: schemaString,
      model: overrideModel,
      skipValidation = false,
    } = body

    if (!documentId || !documentTypeId || !schemaString) {
      return new Response('documentId, documentTypeId, and schema are required', {
        status: 400,
      })
    }

    // Validate admin privileges for model override
    let validatedOverrideModel = overrideModel
    if (overrideModel && !authCheck.isApiKey) {
      const permissionCheck = await checkDocumentPermissions(['update'])
      if (!permissionCheck.success) {
        // Non-admin users cannot override models - ignore the parameter
        validatedOverrideModel = undefined
        console.warn(
          'Non-admin user attempted to override model in processing, ignoring parameter',
        )
      }
    }

    // Validate schema is valid JSON
    let parsedSchema
    try {
      parsedSchema = JSON.parse(schemaString)
    } catch {
      return new Response('Invalid schema JSON', { status: 400 })
    }

    // Verify document exists and user has permission to access it
    const doc = await getDocument(documentId)
    if (!doc) {
      return new Response(`Document not found: ${documentId}`, { status: 404 })
    }
    if (doc.documentTypeId !== documentTypeId) {
      return new Response(
        `Document ${documentId} does not belong to document type ${documentTypeId}`,
        { status: 400 },
      )
    }

    // Get user ID and name from auth
    const userId = authCheck.session?.user?.id
    const userName = authCheck.session?.user?.name || 'Unknown User'
    if (!userId) {
      return new Response('User ID not found', { status: 401 })
    }

    // Use shared service to queue the job
    // Enable streaming for manual single-document processing (user watches progress)
    const { jobIds } = await queueDocumentProcessing({
      documentIds: [documentId],
      documentTypeId,
      schema: parsedSchema,
      userId,
      userName,
      overrideModel: validatedOverrideModel,
      skipValidation,
      enableStreaming: true, // Enable real-time streaming updates for UI
    })

    return Response.json({
      success: true,
      jobId: jobIds[0],
      documentId,
    })
  } catch (error) {
    console.error('Failed to submit processing job:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
