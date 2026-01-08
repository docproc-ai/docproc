# Storage (Target)

## Overview

The target architecture supports multiple storage backends through a unified interface. This enables flexible deployment options from simple local development to scalable production.

## Storage Options

| Option | Best For | Complexity |
|--------|----------|------------|
| **Local Filesystem** | Development | Lowest |
| **S3-Compatible** | Production, scaling | Medium |
| **Database Blobs** | Simple deployments | Low |

## Configuration

```env
# Choose storage backend
STORAGE_TYPE=local|s3|database

# Local filesystem (development)
STORAGE_LOCAL_DIR=./data/documents

# S3-compatible (production)
S3_BUCKET=docproc-documents
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx
S3_ENDPOINT=https://s3.amazonaws.com  # or MinIO, R2, etc.

# Database (simple deployments)
# No additional config - uses DATABASE_URL
```

## Storage Interface

```typescript
// src/server/storage/index.ts

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

// Factory function
export function createStorage(): StorageProvider {
  switch (process.env.STORAGE_TYPE) {
    case 's3':
      return new S3StorageProvider()
    case 'database':
      return new DatabaseStorageProvider()
    case 'local':
    default:
      return new LocalStorageProvider()
  }
}

// Singleton instance
export const storage = createStorage()
```

## Local Filesystem

Development and simple deployments.

```typescript
// src/server/storage/local.ts
import { readFile, writeFile, unlink, access } from 'fs/promises'
import { join } from 'path'
import { lookup } from 'mime-types'

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string

  constructor() {
    this.baseDir = process.env.STORAGE_LOCAL_DIR || './data/documents'
  }

  async upload(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const key = `${crypto.randomUUID()}${extname(filename)}`
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

  async delete(key: string): Promise<void> {
    const path = join(this.baseDir, key)
    await unlink(path)
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(join(this.baseDir, key))
      return true
    } catch {
      return false
    }
  }
}
```

## S3-Compatible Storage

Production deployments with AWS S3, MinIO, Cloudflare R2, etc.

```typescript
// src/server/storage/s3.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export class S3StorageProvider implements StorageProvider {
  private client: S3Client
  private bucket: string

  constructor() {
    this.bucket = process.env.S3_BUCKET!

    this.client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      // For MinIO, R2, etc.
      forcePathStyle: !!process.env.S3_ENDPOINT,
    })
  }

  async upload(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const key = `documents/${crypto.randomUUID()}${extname(filename)}`

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }))

    return key
  }

  async download(key: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }))

    const buffer = Buffer.from(await response.Body!.transformToByteArray())
    const mimeType = response.ContentType || 'application/octet-stream'

    return { buffer, mimeType }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }))
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }))
      return true
    } catch {
      return false
    }
  }

  async getUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    return getSignedUrl(this.client, command, { expiresIn })
  }
}
```

### Direct Upload (Optional)

For large files, allow clients to upload directly to S3:

```typescript
// src/server/routes/files.ts
app.post('/api/upload-url', requireAuth, async (c) => {
  const { filename, contentType } = await c.req.json()

  if (storage instanceof S3StorageProvider) {
    const key = `documents/${crypto.randomUUID()}${extname(filename)}`
    const url = await storage.getPresignedUploadUrl(key, contentType)

    return c.json({ url, key })
  }

  // Fallback for non-S3 storage
  return c.json({ error: 'Direct upload not supported' }, 400)
})
```

## Database Blob Storage

Store files directly in PostgreSQL. Simple, no additional infrastructure.

### Schema

```sql
CREATE TABLE document_files (
  id TEXT PRIMARY KEY,
  document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
  data BYTEA NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_document_files_document_id ON document_files(document_id);
```

### Implementation

```typescript
// src/server/storage/database.ts
import { db } from '../../db'
import { documentFiles } from '../../db/schema'

export class DatabaseStorageProvider implements StorageProvider {
  async upload(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const key = crypto.randomUUID()

    await db.insert(documentFiles).values({
      id: key,
      data: buffer,
      mimeType,
      size: buffer.length,
    })

    return key
  }

  async download(key: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const file = await db.query.documentFiles.findFirst({
      where: eq(documentFiles.id, key),
    })

    if (!file) {
      throw new Error('File not found')
    }

    return {
      buffer: Buffer.from(file.data),
      mimeType: file.mimeType,
    }
  }

  async delete(key: string): Promise<void> {
    await db.delete(documentFiles).where(eq(documentFiles.id, key))
  }

  async exists(key: string): Promise<boolean> {
    const file = await db.query.documentFiles.findFirst({
      where: eq(documentFiles.id, key),
      columns: { id: true },
    })

    return !!file
  }
}
```

### Considerations

**Pros**:
- No additional infrastructure
- Transactional with document records
- Simple backup (just database)
- Works with any PostgreSQL host

**Cons**:
- Increases database size
- Higher memory usage on queries
- Not ideal for files > 10MB
- May need larger database instance

**Best For**:
- Small deployments (< 10GB total files)
- Documents under 10MB each
- Simplified operations priority

## Usage in Routes

```typescript
// src/server/routes/documents.ts
import { storage } from '../storage'

// Upload
app.post('/api/documents', requireAuth, async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File

  const buffer = Buffer.from(await file.arrayBuffer())
  const storageKey = await storage.upload(buffer, file.name, file.type)

  const document = await db.insert(documents).values({
    filename: file.name,
    storageKey,
    // ...
  }).returning()

  return c.json(document)
})

// Download
app.get('/api/documents/:id/file', requireApiKeyOrAuth, async (c) => {
  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, c.req.param('id')),
  })

  if (!doc) return c.json({ error: 'Not found' }, 404)

  // For S3, optionally redirect to presigned URL
  if (storage.getUrl) {
    const url = await storage.getUrl(doc.storageKey)
    return c.redirect(url)
  }

  // Otherwise stream from storage
  const { buffer, mimeType } = await storage.download(doc.storageKey)

  return new Response(buffer, {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${doc.filename}"`,
    },
  })
})

// Delete
app.delete('/api/documents/:id', requireAuth, async (c) => {
  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, c.req.param('id')),
  })

  if (doc) {
    await storage.delete(doc.storageKey)
    await db.delete(documents).where(eq(documents.id, doc.id))
  }

  return c.json({ success: true })
})
```

## Migration from Local to S3

```typescript
// scripts/migrate-storage.ts
import { storage as targetStorage } from '../src/server/storage'
import { LocalStorageProvider } from '../src/server/storage/local'
import { db } from '../src/db'
import { documents } from '../src/db/schema'

async function migrate() {
  const sourceStorage = new LocalStorageProvider()
  const docs = await db.select().from(documents)

  for (const doc of docs) {
    console.log(`Migrating ${doc.filename}...`)

    // Download from local
    const { buffer, mimeType } = await sourceStorage.download(doc.storageKey)

    // Upload to new storage
    const newKey = await targetStorage.upload(buffer, doc.filename, mimeType)

    // Update record
    await db.update(documents)
      .set({ storageKey: newKey })
      .where(eq(documents.id, doc.id))

    // Optionally delete from local
    await sourceStorage.delete(doc.storageKey)
  }

  console.log('Migration complete!')
}

migrate()
```

## Comparison

| Feature | Local | S3 | Database |
|---------|-------|-----|----------|
| Setup complexity | None | Medium | None |
| Scalability | Limited | Unlimited | Limited |
| Redundancy | None | Built-in | DB-level |
| Cost | None | Pay-per-use | DB storage |
| Direct client access | No | Presigned URLs | No |
| Max file size | Disk space | 5GB | ~100MB practical |
| Backup | Manual | S3 versioning | DB backup |
| CDN integration | Manual | Easy | Hard |
