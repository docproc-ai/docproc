import { readFile, writeFile, unlink, access, mkdir } from 'fs/promises'
import { join, extname } from 'path'
import { lookup } from 'mime-types'
import type { StorageProvider } from './types'

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string

  constructor(baseDir?: string) {
    this.baseDir =
      baseDir || process.env.STORAGE_LOCAL_DIR || './data/documents'
    // Resolve relative paths
    if (!this.baseDir.startsWith('/')) {
      this.baseDir = join(process.cwd(), this.baseDir)
    }
  }

  private async ensureDir(): Promise<void> {
    try {
      await access(this.baseDir)
    } catch {
      await mkdir(this.baseDir, { recursive: true })
    }
  }

  async upload(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<string> {
    await this.ensureDir()

    const ext = extname(filename) || this.getExtensionFromMimeType(mimeType)
    const key = `${crypto.randomUUID()}${ext}`
    const path = join(this.baseDir, key)

    await writeFile(path, buffer)

    return key
  }

  async download(key: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const path = join(this.baseDir, key)
    const buffer = await readFile(path)
    const mimeType = lookup(key) || 'application/octet-stream'

    return { buffer, mimeType }
  }

  async save(key: string, buffer: Buffer): Promise<void> {
    const path = join(this.baseDir, key)
    await writeFile(path, buffer)
  }

  async delete(key: string): Promise<void> {
    const path = join(this.baseDir, key)
    try {
      await unlink(path)
    } catch (error) {
      // Ignore file not found errors
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(join(this.baseDir, key))
      return true
    } catch {
      return false
    }
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/tiff': '.tiff',
    }
    return mimeToExt[mimeType] || ''
  }
}
