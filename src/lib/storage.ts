import { join } from 'path'

/**
 * Get the configured document storage directory.
 * Supports both relative and absolute paths via DOCUMENT_STORAGE_DIR environment variable.
 * Falls back to './data/documents' if not configured.
 */
export function getStorageDir(): string {
  const storageDir = process.env.DOCUMENT_STORAGE_DIR || './data/documents'
  return storageDir.startsWith('/') ? storageDir : join(process.cwd(), storageDir)
}
