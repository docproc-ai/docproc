import fs from 'fs/promises'
import path from 'path'
import { createHash } from 'crypto'

const DATA_DIR = process.env.DATA_DIR || './data'
const FILES_DIR = path.join(DATA_DIR, 'files')

// File storage utilities
export class FileStorage {
  // Generate a unique file path for a document
  static generateFilePath(
    documentTypeId: string,
    documentId: string,
    originalFilename: string,
  ): string {
    const ext = path.extname(originalFilename)
    const baseName = path.basename(originalFilename, ext)

    // Shard by document type for better organization
    // Structure: data/files/{document_type_id}/{document_id}_{original_name}{ext}
    return path.join(FILES_DIR, documentTypeId, `${documentId}_${baseName}${ext}`)
  }

  // Calculate SHA-256 hash of file content
  static calculateHash(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex')
  }

  // Store file content and return file path and hash
  static async storeFile(
    documentTypeId: string,
    documentId: string,
    originalFilename: string,
    content: Buffer,
  ): Promise<{ filePath: string; fileHash: string }> {
    const filePath = this.generateFilePath(documentTypeId, documentId, originalFilename)
    const fileHash = this.calculateHash(content)

    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    // Write file
    await fs.writeFile(filePath, content)

    return { filePath, fileHash }
  }

  // Read file content
  static async readFile(filePath: string): Promise<Buffer> {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(DATA_DIR, filePath)
    return await fs.readFile(fullPath)
  }

  // Check if file exists
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(DATA_DIR, filePath)
      await fs.access(fullPath)
      return true
    } catch {
      return false
    }
  }

  // Delete file
  static async deleteFile(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(DATA_DIR, filePath)
      await fs.unlink(fullPath)
      return true
    } catch {
      return false
    }
  }

  // Get file stats
  static async getFileStats(filePath: string): Promise<{ size: number; mtime: Date } | null> {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(DATA_DIR, filePath)
      const stats = await fs.stat(fullPath)
      return {
        size: stats.size,
        mtime: stats.mtime,
      }
    } catch {
      return null
    }
  }

  // Verify file integrity using hash
  static async verifyFileIntegrity(filePath: string, expectedHash: string): Promise<boolean> {
    try {
      const content = await this.readFile(filePath)
      const actualHash = this.calculateHash(content)
      return actualHash === expectedHash
    } catch {
      return false
    }
  }

  // Get relative path from absolute path (for storing in database)
  static getRelativePath(absolutePath: string): string {
    return path.relative(DATA_DIR, absolutePath)
  }

  // Get absolute path from relative path (for file operations)
  static getAbsolutePath(relativePath: string): string {
    return path.resolve(DATA_DIR, relativePath)
  }

  // Migrate base64 content to file storage
  static async migrateBase64ToFile(
    documentTypeId: string,
    documentId: string,
    originalFilename: string,
    base64Content: string,
  ): Promise<{ filePath: string; fileHash: string }> {
    const content = Buffer.from(base64Content, 'base64')
    return await this.storeFile(documentTypeId, documentId, originalFilename, content)
  }

  // Clean up orphaned files (files that don't have corresponding database records)
  static async cleanupOrphanedFiles(validFilePaths: string[]): Promise<number> {
    let deletedCount = 0

    try {
      // Get all files in the files directory
      const allFiles = await this.getAllFiles(FILES_DIR)

      // Convert valid paths to absolute paths for comparison
      const validAbsolutePaths = validFilePaths.map((p) =>
        path.isAbsolute(p) ? p : this.getAbsolutePath(p),
      )

      // Delete files that are not in the valid list
      for (const filePath of allFiles) {
        if (!validAbsolutePaths.includes(filePath)) {
          try {
            await fs.unlink(filePath)
            deletedCount++
            console.log(`Deleted orphaned file: ${filePath}`)
          } catch (error) {
            console.warn(`Failed to delete orphaned file ${filePath}:`, error)
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup orphaned files:', error)
    }

    return deletedCount
  }

  // Recursively get all files in a directory
  private static async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = []

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          const subFiles = await this.getAllFiles(fullPath)
          files.push(...subFiles)
        } else if (entry.isFile()) {
          files.push(fullPath)
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return files
  }
}

// Helper function to determine MIME type from file extension
export function getMimeTypeFromExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const mimeTypes: { [key: string]: string } = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.csv': 'text/csv',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  }

  return mimeTypes[ext] || 'application/octet-stream'
}
