import Datastore from '@seald-io/nedb'
import path from 'path'

const DATA_DIR = process.env.DATA_DIR || './data'

// Cache for database instances
const dbCache = new Map<string, Datastore>()

// Document Type interface for NeDB
export interface DocumentTypeRecord {
  _id?: string
  id: string
  name: string
  schema: any
  webhook_url?: string
  webhook_method?: 'POST' | 'PUT'
  created_at: string
}

// Document interface for NeDB
export interface DocumentRecord {
  _id?: string
  id: string
  document_type_id: string
  status: 'pending' | 'approved' | 'rejected' | 'processing_failed'
  original_filename: string
  uploaded_at: string
  processed_at?: string
  file_size?: number
  mime_type?: string
  // File path instead of base64 content
  file_path?: string
  file_hash?: string // SHA-256 hash for integrity
  // Extracted data and schema
  extracted_data?: any
  schema_snapshot?: any
}

// Get or create global document types database
export function getDocumentTypesDatabase(): Datastore<DocumentTypeRecord> {
  const cacheKey = 'document_types'

  if (dbCache.has(cacheKey)) {
    return dbCache.get(cacheKey)!
  }

  const dbPath = path.join(DATA_DIR, 'document-types.jsonl')
  const db = new Datastore<DocumentTypeRecord>({
    filename: dbPath,
    autoload: true,
    timestampData: false,
  })

  // Create indexes
  db.ensureIndex({ fieldName: 'id', unique: true })
  db.ensureIndex({ fieldName: 'name' })
  db.ensureIndex({ fieldName: 'created_at' })

  dbCache.set(cacheKey, db)
  return db
}

// Get or create global documents database
export function getDocumentsDatabase(): Datastore<DocumentRecord> {
  const cacheKey = 'documents'

  if (dbCache.has(cacheKey)) {
    return dbCache.get(cacheKey)!
  }

  const dbPath = path.join(DATA_DIR, 'documents.jsonl')
  const db = new Datastore<DocumentRecord>({
    filename: dbPath,
    autoload: true,
    timestampData: false,
  })

  // Create indexes for better performance
  db.ensureIndex({ fieldName: 'status' })
  db.ensureIndex({ fieldName: 'uploaded_at' })
  db.ensureIndex({ fieldName: 'document_type_id' })
  db.ensureIndex({ fieldName: 'id', unique: true })

  dbCache.set(cacheKey, db)
  return db
}

// Document Types Database Operations
export class DocumentTypesDatabase {
  private db: Datastore<DocumentTypeRecord>

  constructor() {
    this.db = getDocumentTypesDatabase()
  }

  // Create a new document type
  async create(documentType: Omit<DocumentTypeRecord, '_id'>): Promise<DocumentTypeRecord> {
    return new Promise((resolve, reject) => {
      this.db.insert(documentType, (err, newDoc) => {
        if (err) reject(err)
        else resolve(newDoc)
      })
    })
  }

  // Find all document types
  async findAll(): Promise<DocumentTypeRecord[]> {
    return new Promise((resolve, reject) => {
      this.db
        .find({})
        .sort({ created_at: -1 })
        .exec((err, docs) => {
          if (err) reject(err)
          else resolve(docs)
        })
    })
  }

  // Find document type by ID
  async findById(id: string): Promise<DocumentTypeRecord | null> {
    return new Promise((resolve, reject) => {
      this.db.findOne({ id }, (err, doc) => {
        if (err) reject(err)
        else resolve(doc)
      })
    })
  }

  // Update document type
  async update(
    id: string,
    updates: Partial<DocumentTypeRecord>,
  ): Promise<DocumentTypeRecord | null> {
    return new Promise((resolve, reject) => {
      this.db.update(
        { id },
        { $set: updates },
        { returnUpdatedDocs: true },
        (err, numReplaced, updatedDoc) => {
          if (err) reject(err)
          else if (numReplaced === 0) resolve(null)
          else resolve(updatedDoc as DocumentTypeRecord)
        },
      )
    })
  }

  // Delete document type
  async delete(id: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.remove({ id }, {}, (err, numRemoved) => {
        if (err) reject(err)
        else resolve(numRemoved > 0)
      })
    })
  }
}

// Documents Database Operations
export class DocumentsDatabase {
  private db: Datastore<DocumentRecord>

  constructor() {
    this.db = getDocumentsDatabase()
  }

  // Create a new document record
  async create(document: Omit<DocumentRecord, '_id'>): Promise<DocumentRecord> {
    return new Promise((resolve, reject) => {
      this.db.insert(document, (err, newDoc) => {
        if (err) reject(err)
        else resolve(newDoc)
      })
    })
  }

  // Find documents with optional query
  async find(query: Partial<DocumentRecord> = {}): Promise<DocumentRecord[]> {
    return new Promise((resolve, reject) => {
      this.db
        .find(query)
        .sort({ uploaded_at: -1 }) // Most recent first
        .exec((err, docs) => {
          if (err) reject(err)
          else resolve(docs)
        })
    })
  }

  // Find documents by document type
  async findByDocumentType(documentTypeId: string): Promise<DocumentRecord[]> {
    return this.find({ document_type_id: documentTypeId })
  }

  // Find a single document by ID
  async findById(id: string): Promise<DocumentRecord | null> {
    return new Promise((resolve, reject) => {
      this.db.findOne({ id }, (err, doc) => {
        if (err) reject(err)
        else resolve(doc)
      })
    })
  }

  // Update a document
  async update(id: string, updates: Partial<DocumentRecord>): Promise<DocumentRecord | null> {
    return new Promise((resolve, reject) => {
      this.db.update(
        { id },
        { $set: updates },
        { returnUpdatedDocs: true },
        (err, numReplaced, updatedDoc) => {
          if (err) reject(err)
          else if (numReplaced === 0) resolve(null)
          else resolve(updatedDoc as DocumentRecord)
        },
      )
    })
  }

  // Delete a document
  async delete(id: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.remove({ id }, {}, (err, numRemoved) => {
        if (err) reject(err)
        else resolve(numRemoved > 0)
      })
    })
  }

  // Count documents with optional query
  async count(query: Partial<DocumentRecord> = {}): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.count(query, (err, count) => {
        if (err) reject(err)
        else resolve(count)
      })
    })
  }

  // Count documents by document type
  async countByDocumentType(documentTypeId: string): Promise<number> {
    return this.count({ document_type_id: documentTypeId })
  }

  // Find documents by status
  async findByStatus(
    status: DocumentRecord['status'],
    documentTypeId?: string,
  ): Promise<DocumentRecord[]> {
    const query: Partial<DocumentRecord> = { status }
    if (documentTypeId) {
      query.document_type_id = documentTypeId
    }
    return this.find(query)
  }

  // Bulk update status
  async updateStatus(ids: string[], status: DocumentRecord['status']): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.update(
        { id: { $in: ids } },
        { $set: { status, processed_at: new Date().toISOString() } },
        { multi: true },
        (err, numReplaced) => {
          if (err) reject(err)
          else resolve(numReplaced)
        },
      )
    })
  }
}

// Legacy class for backward compatibility
export class DocumentDatabase extends DocumentsDatabase {
  private documentTypeId: string

  constructor(documentTypeId: string) {
    super()
    this.documentTypeId = documentTypeId
  }

  // Override methods to filter by document type
  async find(query: Partial<DocumentRecord> = {}): Promise<DocumentRecord[]> {
    return super.find({ ...query, document_type_id: this.documentTypeId })
  }

  async count(query: Partial<DocumentRecord> = {}): Promise<number> {
    return super.count({ ...query, document_type_id: this.documentTypeId })
  }

  async findByStatus(status: DocumentRecord['status']): Promise<DocumentRecord[]> {
    return super.findByStatus(status, this.documentTypeId)
  }
}

// Utility function to migrate existing JSON metadata to NeDB
export async function migrateMetadataToNeDB(documentTypeId: string): Promise<void> {
  const db = new DocumentDatabase(documentTypeId)
  const fs = await import('fs/promises')

  const documentsDir = path.join(DATA_DIR, 'document-types', documentTypeId, 'documents')

  try {
    const docIds = await fs.readdir(documentsDir)

    for (const docId of docIds) {
      const metadataPath = path.join(documentsDir, docId, 'metadata.json')

      try {
        // Check if document already exists in NeDB
        const existing = await db.findById(docId)
        if (existing) {
          console.log(`Document ${docId} already exists in database, skipping...`)
          continue
        }

        // Read metadata from JSON file
        const metadataContent = await fs.readFile(metadataPath, 'utf-8')
        const metadata = JSON.parse(metadataContent)

        // Get file stats for additional metadata
        const filePath = path.join(
          documentsDir,
          docId,
          `file${path.extname(metadata.original_filename)}`,
        )
        let fileSize = 0
        let mimeType = 'application/octet-stream'

        try {
          const stats = await fs.stat(filePath)
          fileSize = stats.size

          // Determine MIME type from extension
          const ext = path.extname(metadata.original_filename).toLowerCase()
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
          }
          mimeType = mimeTypes[ext] || 'application/octet-stream'
        } catch {
          // File might not exist, continue with defaults
        }

        // Create document record
        const documentRecord: Omit<DocumentRecord, '_id'> = {
          id: metadata.id,
          document_type_id: metadata.document_type_id,
          status: metadata.status,
          original_filename: metadata.original_filename,
          uploaded_at: metadata.uploaded_at,
          processed_at: metadata.processed_at,
          file_size: fileSize,
          mime_type: mimeType,
        }

        await db.create(documentRecord)
        console.log(`Migrated document ${docId} to NeDB`)

        // Optionally remove the old metadata.json file
        // await fs.unlink(metadataPath)
      } catch (error) {
        console.warn(`Failed to migrate document ${docId}:`, error)
      }
    }

    console.log(`Migration completed for document type: ${documentTypeId}`)
  } catch (error) {
    console.warn(`Failed to migrate document type ${documentTypeId}:`, error)
  }
}
