import pLimit from 'p-limit'
import { processAndSaveDocument } from './processor'
import type { ProcessingOptions } from './shared'

export interface BatchProgressCallback {
  (completed: number, total: number, documentId: string, error?: Error): void
}

export interface BatchResult {
  completed: string[]
  failed: Array<{ documentId: string; error: string }>
}

/**
 * Process multiple documents with controlled concurrency
 * @param documentIds - Array of document IDs to process
 * @param options - Processing options
 * @param concurrency - Maximum number of concurrent processing operations (default: 3)
 * @param onProgress - Callback for progress updates
 */
export async function processDocumentBatch(
  documentIds: string[],
  options: ProcessingOptions = {},
  concurrency: number = 3,
  onProgress?: BatchProgressCallback,
): Promise<BatchResult> {
  const results: BatchResult = {
    completed: [],
    failed: [],
  }

  let completedCount = 0
  const limit = pLimit(concurrency)

  const tasks = documentIds.map((documentId) =>
    limit(async () => {
      try {
        await processAndSaveDocument(documentId, options)
        results.completed.push(documentId)
        completedCount++
        onProgress?.(completedCount, documentIds.length, documentId)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.failed.push({ documentId, error: errorMessage })
        completedCount++
        onProgress?.(completedCount, documentIds.length, documentId, error as Error)
      }
    }),
  )

  await Promise.all(tasks)

  return results
}
