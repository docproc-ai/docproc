export interface StorageProvider {
  /**
   * Upload a file and return its storage key
   */
  upload(buffer: Buffer, filename: string, mimeType: string): Promise<string>

  /**
   * Download a file by its storage key
   */
  download(key: string): Promise<{ buffer: Buffer; mimeType: string }>

  /**
   * Delete a file by its storage key
   */
  delete(key: string): Promise<void>

  /**
   * Check if a file exists
   */
  exists(key: string): Promise<boolean>

  /**
   * Get a URL for direct access (optional, for S3 presigned URLs)
   */
  getUrl?(key: string, expiresIn?: number): Promise<string>
}
