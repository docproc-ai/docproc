import {
  DocumentTypesDatabase,
  DocumentsDatabase,
  DocumentTypeRecord,
  DocumentRecord,
} from './database'
import { FileStorage } from './file-storage'

// Helper function to slugify document type names
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Document Types
export interface DocumentType {
  id: string
  name: string
  schema: any
  webhook_url?: string
  webhook_method?: 'POST' | 'PUT'
  created_at: string
}

export async function createDocumentType(
  data: Omit<DocumentType, 'id' | 'created_at'>,
): Promise<DocumentType> {
  const db = new DocumentTypesDatabase()

  const id = slugify(data.name)
  const documentType: DocumentTypeRecord = {
    ...data,
    id,
    created_at: new Date().toISOString(),
  }

  const created = await db.create(documentType)

  return {
    id: created.id,
    name: created.name,
    schema: created.schema,
    webhook_url: created.webhook_url,
    webhook_method: created.webhook_method,
    created_at: created.created_at,
  }
}

export async function getDocumentTypes(): Promise<(DocumentType & { document_count: number })[]> {
  const typesDb = new DocumentTypesDatabase()
  const docsDb = new DocumentsDatabase()

  try {
    const types = await typesDb.findAll()
    const typesWithCounts = []

    for (const type of types) {
      const documentCount = await docsDb.countByDocumentType(type.id)

      typesWithCounts.push({
        id: type.id,
        name: type.name,
        schema: type.schema,
        webhook_url: type.webhook_url,
        webhook_method: type.webhook_method,
        created_at: type.created_at,
        document_count: documentCount,
      })
    }

    return typesWithCounts
  } catch {
    return []
  }
}

export async function getDocumentType(id: string): Promise<DocumentType | null> {
  const db = new DocumentTypesDatabase()

  try {
    const record = await db.findById(id)
    if (!record) return null

    return {
      id: record.id,
      name: record.name,
      schema: record.schema,
      webhook_url: record.webhook_url,
      webhook_method: record.webhook_method,
      created_at: record.created_at,
    }
  } catch {
    return null
  }
}

export async function updateDocumentType(
  id: string,
  updates: Partial<DocumentType>,
): Promise<DocumentType | null> {
  const db = new DocumentTypesDatabase()

  try {
    const updated = await db.update(id, updates)
    if (!updated) return null

    return {
      id: updated.id,
      name: updated.name,
      schema: updated.schema,
      webhook_url: updated.webhook_url,
      webhook_method: updated.webhook_method,
      created_at: updated.created_at,
    }
  } catch {
    return null
  }
}

export async function deleteDocumentType(id: string): Promise<boolean> {
  const typesDb = new DocumentTypesDatabase()
  const docsDb = new DocumentsDatabase()

  try {
    // First delete all documents of this type
    const documents = await docsDb.findByDocumentType(id)
    for (const doc of documents) {
      await docsDb.delete(doc.id)
    }

    // Then delete the document type
    return await typesDb.delete(id)
  } catch {
    return false
  }
}

// Documents
export interface Document {
  id: string
  document_type_id: string
  status: 'pending' | 'approved' | 'rejected' | 'processing_failed'
  original_filename: string
  uploaded_at: string
  processed_at?: string
}

export interface DocumentWithData extends Document {
  extracted_data?: any
  schema_snapshot?: any
  storage_path?: string
}

export async function createDocument(
  documentTypeId: string,
  filename: string,
  fileBuffer: Buffer,
): Promise<Document> {
  const typesDb = new DocumentTypesDatabase()
  const docsDb = new DocumentsDatabase()

  // Verify document type exists
  const documentType = await typesDb.findById(documentTypeId)
  if (!documentType) {
    throw new Error('Document type not found')
  }

  const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Determine MIME type
  const fileExt = filename.split('.').pop()?.toLowerCase() || ''
  const mimeTypes: { [key: string]: string } = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
  }
  const mimeType = mimeTypes[fileExt] || 'application/octet-stream'

  // Store file in filesystem using FileStorage
  const { filePath, fileHash } = await FileStorage.storeFile(
    documentTypeId,
    docId,
    filename,
    fileBuffer,
  )

  // Get relative path for database storage
  const relativePath = FileStorage.getRelativePath(filePath)

  // Create document record with file path instead of content
  const documentRecord: Omit<DocumentRecord, '_id'> = {
    id: docId,
    document_type_id: documentTypeId,
    status: 'pending',
    original_filename: filename,
    uploaded_at: new Date().toISOString(),
    file_size: fileBuffer.length,
    mime_type: mimeType,
    file_path: relativePath,
    file_hash: fileHash,
  }

  const created = await docsDb.create(documentRecord)

  return {
    id: created.id,
    document_type_id: created.document_type_id,
    status: created.status,
    original_filename: created.original_filename,
    uploaded_at: created.uploaded_at,
    processed_at: created.processed_at,
  }
}

export async function getDocuments(documentTypeId: string): Promise<DocumentWithData[]> {
  const docsDb = new DocumentsDatabase()

  try {
    const documentRecords = await docsDb.findByDocumentType(documentTypeId)

    return documentRecords.map((record) => ({
      id: record.id,
      document_type_id: record.document_type_id,
      status: record.status,
      original_filename: record.original_filename,
      uploaded_at: record.uploaded_at,
      processed_at: record.processed_at,
      storage_path: `/api/documents/${record.id}/file`,
      extracted_data: record.extracted_data,
      schema_snapshot: record.schema_snapshot,
    }))
  } catch (error) {
    console.error(`Failed to get documents for ${documentTypeId}:`, error)
    return []
  }
}

export async function getDocument(
  documentTypeId: string,
  docId: string,
): Promise<DocumentWithData | null> {
  const docsDb = new DocumentsDatabase()

  try {
    const record = await docsDb.findById(docId)
    if (!record || record.document_type_id !== documentTypeId) return null

    return {
      id: record.id,
      document_type_id: record.document_type_id,
      status: record.status,
      original_filename: record.original_filename,
      uploaded_at: record.uploaded_at,
      processed_at: record.processed_at,
      storage_path: `/api/documents/${record.id}/file`,
      extracted_data: record.extracted_data,
      schema_snapshot: record.schema_snapshot,
    }
  } catch {
    return null
  }
}

export async function updateDocument(
  documentTypeId: string,
  docId: string,
  updates: Partial<Document>,
): Promise<Document | null> {
  const docsDb = new DocumentsDatabase()

  try {
    // Verify document belongs to the specified type
    const existing = await docsDb.findById(docId)
    if (!existing || existing.document_type_id !== documentTypeId) {
      return null
    }

    const updated = await docsDb.update(docId, updates)
    if (!updated) return null

    return {
      id: updated.id,
      document_type_id: updated.document_type_id,
      status: updated.status,
      original_filename: updated.original_filename,
      uploaded_at: updated.uploaded_at,
      processed_at: updated.processed_at,
    }
  } catch {
    return null
  }
}

export async function saveDocumentData(
  documentTypeId: string,
  docId: string,
  extractedData: any,
  schemaSnapshot: any,
): Promise<void> {
  const docsDb = new DocumentsDatabase()

  // Update document with extracted data and schema
  await docsDb.update(docId, {
    extracted_data: extractedData,
    schema_snapshot: schemaSnapshot,
    status: 'approved',
    processed_at: new Date().toISOString(),
  })
}

export async function getDocumentFile(
  documentTypeId: string,
  docId: string,
): Promise<{ buffer: Buffer; filename: string } | null> {
  const docsDb = new DocumentsDatabase()

  try {
    const record = await docsDb.findById(docId)
    if (!record || record.document_type_id !== documentTypeId || !record.file_path) {
      return null
    }

    // Load file from filesystem using FileStorage
    const buffer = await FileStorage.readFile(record.file_path)
    return {
      buffer,
      filename: record.original_filename,
    }
  } catch {
    return null
  }
}

export async function deleteDocument(documentTypeId: string, docId: string): Promise<boolean> {
  const docsDb = new DocumentsDatabase()

  try {
    // Verify document belongs to the specified type
    const existing = await docsDb.findById(docId)
    if (!existing || existing.document_type_id !== documentTypeId) {
      return false
    }

    return await docsDb.delete(docId)
  } catch {
    return false
  }
}
