import pLimit from 'p-limit'
import { processAndSaveDocument } from './processor'
import type { ProcessingOptions } from './shared'

const DEFAULT_CONCURRENCY = 5

export type BatchProgressCallback = (
  completed: number,
  total: number,
  documentId: string,
  error?: Error,
) => void

export interface BatchResult {
  completed: string[]
  failed: Array<{ documentId: string; error: string }>
  skipped: string[]
}

export type ShouldProcessCheck = (documentId: string) => Promise<boolean>

/**
 * Process multiple documents concurrently with cancellation support
 * @param documentIds - Array of document IDs to process
 * @param options - Processing options
 * @param shouldProcess - Callback to check if a document should still be processed (for cancellation)
 * @param onProgress - Callback for progress updates
 * @param concurrency - Maximum number of concurrent document processing tasks (default: 5)
 */
export async function processDocumentBatch(
  documentIds: string[],
  options: ProcessingOptions = {},
  shouldProcess?: ShouldProcessCheck,
  onProgress?: BatchProgressCallback,
  concurrency: number = DEFAULT_CONCURRENCY,
): Promise<BatchResult> {
  const results: BatchResult = {
    completed: [],
    failed: [],
    skipped: [],
  }

  let completedCount = 0
  const limit = pLimit(concurrency)

  const tasks = documentIds.map((documentId) =>
    limit(async () => {
      // Check if this document should still be processed (job not cancelled)
      if (shouldProcess) {
        const shouldContinue = await shouldProcess(documentId)
        if (!shouldContinue) {
          results.skipped.push(documentId)
          completedCount++
          return
        }
      }

      try {
        await processAndSaveDocument(documentId, options)
        results.completed.push(documentId)
        completedCount++
        onProgress?.(completedCount, documentIds.length, documentId)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        results.failed.push({ documentId, error: errorMessage })
        completedCount++
        onProgress?.(
          completedCount,
          documentIds.length,
          documentId,
          error as Error,
        )
      }
    }),
  )

  await Promise.all(tasks)

  return results
}
