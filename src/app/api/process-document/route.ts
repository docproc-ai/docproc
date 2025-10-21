import { checkDocumentPermissions } from '@/lib/auth-utils'
import { NextRequest } from 'next/server'
import { checkApiAuth } from '@/lib/api-auth'
import { checkAIRateLimit } from '@/lib/ai-rate-limit'
import { getDocumentStreamingProcessor, processDocumentText } from '@/lib/document-processing/processor'

/**
 * @deprecated This endpoint is deprecated and will be removed in a future version.
 *
 * Please use the new BullMQ-based processing endpoints instead:
 * - Single document: POST /api/jobs/process-single
 * - Batch processing: POST /api/jobs/batch-process
 * - Job status polling: GET /api/jobs/status?jobIds=...
 *
 * The new endpoints provide:
 * - Asynchronous processing with job queue
 * - Better scalability for high-volume processing
 * - Real-time progress updates via Server-Sent Events
 * - Unified processing logic across all entry points
 */
export async function POST(req: NextRequest) {
  // Log deprecation warning
  console.warn(
    '[DEPRECATED] /api/process-document is deprecated. Use /api/jobs/process-single or /api/jobs/batch-process instead.'
  )
  try {
    // Check if user has permission to process documents (or has valid API key)
    const authCheck = await checkApiAuth({
      document: ['update'], // Processing documents requires update permission
    })

    if (!authCheck.success) {
      return new Response('Insufficient permissions', { status: 403 })
    }

    // Check if streaming mode is requested
    const url = new URL(req.url)
    const isStreamMode = url.searchParams.get('stream') === 'true'
    const skipValidation = url.searchParams.get('skipValidation') === 'true'

    const body = await req.json()
    const { documentId, documentTypeId, schema: schemaString, model: overrideModel } = body

    if (!documentId || !documentTypeId || !schemaString) {
      return new Response('Document ID, document type ID, and schema are required', {
        status: 400,
      })
    }

    // Check AI rate limit after parsing request body
    try {
      await checkAIRateLimit('process-document')
    } catch (error) {
      return new Response(error instanceof Error ? error.message : 'Rate limit exceeded', {
        status: 429,
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
          'Non-admin user attempted to override model in processDocument, ignoring parameter',
        )
      }
    }

    let schema
    try {
      schema = JSON.parse(schemaString)
    } catch {
      return new Response('Invalid schema JSON', { status: 400 })
    }

    if (isStreamMode) {
      // Streaming mode for single document processing
      const result = await getDocumentStreamingProcessor(
        documentId,
        documentTypeId,
        schema,
        {
          skipValidation,
          overrideModel: validatedOverrideModel,
        }
      )

      // Check if document was rejected during validation
      if ('rejected' in result && result.rejected) {
        return Response.json(
          {
            success: false,
            rejected: true,
            error: 'Document validation failed',
            message: result.reason,
            document: result.document,
          },
          {
            headers: {
              'X-API-Warn': 'Deprecated endpoint. Use /api/jobs/process-single instead.',
              Deprecation: 'true',
            },
          }
        )
      }

      const streamResponse = result.toTextStreamResponse()
      streamResponse.headers.set(
        'X-API-Warn',
        'Deprecated endpoint. Use /api/jobs/process-single instead.'
      )
      streamResponse.headers.set('Deprecation', 'true')
      return streamResponse
    } else {
      // Non-streaming mode for batch processing
      try {
        const { data } = await processDocumentText(
          documentId,
          documentTypeId,
          schema,
          {
            skipValidation,
            overrideModel: validatedOverrideModel,
          }
        )

        return Response.json(
          {
            success: true,
            data,
            documentId,
          },
          {
            headers: {
              'X-API-Warn': 'Deprecated endpoint. Use /api/jobs/batch-process instead.',
              Deprecation: 'true',
            },
          }
        )
      } catch (error) {
        // Check if this is a validation rejection
        if (error instanceof Error && error.message.includes('Document validation failed')) {
          // Get the rejected document from database
          const { getDocument } = await import('@/lib/actions/document')
          const rejectedDoc = await getDocument(documentId)

          return Response.json(
            {
              success: false,
              rejected: true,
              error: 'Document validation failed',
              message: error.message.replace('Document validation failed: ', ''),
              document: rejectedDoc,
            },
            {
              headers: {
                'X-API-Warn': 'Deprecated endpoint. Use /api/jobs/batch-process instead.',
                Deprecation: 'true',
              },
            }
          )
        }

        // Check if model returned non-JSON
        if (error instanceof Error && error.message.includes('Model returned text instead of JSON')) {
          return Response.json(
            {
              success: false,
              error: error.message,
              message: error.message,
            },
            {
              headers: {
                'X-API-Warn': 'Deprecated endpoint. Use /api/jobs/batch-process instead.',
                Deprecation: 'true',
              },
            }
          )
        }

        throw error
      }
    }
  } catch (error) {
    console.error('Failed to process document:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
