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
      documentIds,
      documentTypeId,
      schema: schemaString,
      model: overrideModel,
    } = body

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return new Response('documentIds array is required and must not be empty', {
        status: 400,
      })
    }

    if (!documentTypeId || !schemaString) {
      return new Response('documentTypeId and schema are required', { status: 400 })
    }

    // Validate admin privileges for model override
    let validatedOverrideModel = overrideModel
    if (overrideModel && !authCheck.isApiKey) {
      const permissionCheck = await checkDocumentPermissions(['update'])
      if (!permissionCheck.success) {
        // Non-admin users cannot override models - ignore the parameter
        validatedOverrideModel = undefined
        console.warn(
          'Non-admin user attempted to override model in batch processing, ignoring parameter',
        )
      }
    }

    // Parse and validate schema
    let parsedSchema
    try {
      parsedSchema = JSON.parse(schemaString)
    } catch {
      return new Response('Invalid schema JSON', { status: 400 })
    }

    // Verify all documents exist and user has permission to access them
    for (const docId of documentIds) {
      const doc = await getDocument(docId)
      if (!doc) {
        return new Response(`Document not found: ${docId}`, { status: 404 })
      }
      if (doc.documentTypeId !== documentTypeId) {
        return new Response(
          `Document ${docId} does not belong to document type ${documentTypeId}`,
          { status: 400 },
        )
      }
    }

    // Get user ID and name from auth
    const userId = authCheck.session?.user?.id
    const userName = authCheck.session?.user?.name || 'Unknown User'
    if (!userId) {
      return new Response('User ID not found', { status: 401 })
    }

    // Use shared service to queue all jobs
    // Use non-streaming mode for batch processing (more efficient, nobody watching)
    const { jobIds, batchId, totalCount } = await queueDocumentProcessing({
      documentIds,
      documentTypeId,
      schema: parsedSchema,
      userId,
      userName,
      overrideModel: validatedOverrideModel,
      enableStreaming: false, // Disable streaming for efficient batch processing
    })

    return Response.json({
      success: true,
      batchId,
      jobIds,
      totalCount,
    })
  } catch (error) {
    console.error('Failed to submit batch processing job:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
