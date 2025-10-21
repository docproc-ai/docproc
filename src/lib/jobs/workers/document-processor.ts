import { Job } from 'bullmq'
import { processDocumentWithProgress, processDocumentStructured } from '@/lib/document-processing/processor'
import { updateDocumentCore } from '@/lib/db/document-operations'

export interface DocumentJobData {
  documentId: string
  documentTypeId: string
  schema: any
  overrideModel?: string
  skipValidation?: boolean
  userId: string
  userName: string
  batchId?: string
  enableStreaming?: boolean
}

export interface DocumentJobResult {
  documentId: string
  success: boolean
  error?: string
}

/**
 * BullMQ worker processor for single document processing
 * Supports streaming progress tracking and real-time updates
 */
export async function processDocument(
  job: Job<DocumentJobData>
): Promise<DocumentJobResult> {
  const { documentId, documentTypeId, schema, overrideModel, skipValidation, batchId, userId, userName, enableStreaming } = job.data

  try {
    // Update progress: starting
    await job.updateProgress({ status: 'starting', progress: 0 })

    if (enableStreaming) {
      // STREAMING MODE: Use streaming for real-time progress updates
      // Best for manual UI-initiated processing where user watches progress
      let chunkCount = 0
      await processDocumentWithProgress(documentId, documentTypeId, schema, {
        overrideModel,
        skipValidation,
        onProgress: async (partialData) => {
          chunkCount++
          // Emit progress with partial extracted data and chunk count
          await job.updateProgress({
            status: 'processing',
            chunks: chunkCount,
            partialData,
          })
        },
      })
    } else {
      // NON-STREAMING MODE: Single efficient request
      // Best for batch processing and automation where nobody is watching
      await job.updateProgress({ status: 'validating', progress: 20 })

      // Process document with single API call
      const { data, validation } = await processDocumentStructured(documentId, documentTypeId, schema, {
        overrideModel,
        skipValidation,
      })

      await job.updateProgress({ status: 'saving', progress: 80 })

      // Save to database
      await updateDocumentCore(documentId, {
        extractedData: data,
        status: 'processed',
        schemaSnapshot: schema,
      })
    }

    // Update progress: completed
    await job.updateProgress({ status: 'completed', progress: 100 })

    return {
      documentId,
      success: true,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`❌ Failed to process document ${documentId}:`, errorMessage)

    // Update progress: failed
    await job.updateProgress({ status: 'failed', progress: 0, error: errorMessage })

    return {
      documentId,
      success: false,
      error: errorMessage,
    }
  }
}
