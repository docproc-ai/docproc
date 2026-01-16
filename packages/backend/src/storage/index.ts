import type { StorageProvider } from './types'
import { LocalStorageProvider } from './local'

export type { StorageProvider }
export { LocalStorageProvider }

/**
 * Create a storage provider based on environment configuration
 */
export function createStorage(): StorageProvider {
  const storageType = process.env.STORAGE_TYPE || 'local'

  switch (storageType) {
    case 's3':
      // TODO: Implement S3StorageProvider when needed
      throw new Error('S3 storage not yet implemented')
    case 'database':
      // TODO: Implement DatabaseStorageProvider when needed
      throw new Error('Database storage not yet implemented')
    case 'local':
    default:
      return new LocalStorageProvider()
  }
}

// Singleton instance
export const storage = createStorage()
