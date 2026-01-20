import { processAndSaveDocument } from './processor'
import type { ProcessingOptions } from './shared'

export interface BatchProgressCallback {
  (completed: number, total: number, documentId: string, error?: Error): void
}

export interface BatchResult {
  completed: string[]
  failed: Array<{ documentId: string; error: string }>
  skipped: string[]
}

export type ShouldProcessCheck = (documentId: string) => Promise<boolean>

/**
 * Process multiple documents sequentially with cancellation support
 * @param documentIds - Array of document IDs to process
 * @param options - Processing options
 * @param shouldProcess - Callback to check if a document should still be processed (for cancellation)
 * @param onProgress - Callback for progress updates
 */
export async function processDocumentBatch(
  documentIds: string[],
  options: ProcessingOptions = {},
  shouldProcess?: ShouldProcessCheck,
  onProgress?: BatchProgressCallback,
): Promise<BatchResult> {
  const results: BatchResult = {
    completed: [],
    failed: [],
    skipped: [],
  }

  let completedCount = 0

  // Process sequentially to allow for cancellation between documents
  for (const documentId of documentIds) {
    // Check if this document should still be processed (job not cancelled)
    if (shouldProcess) {
      const shouldContinue = await shouldProcess(documentId)
      if (!shouldContinue) {
        results.skipped.push(documentId)
        completedCount++
        continue
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
  }

  return results
}
