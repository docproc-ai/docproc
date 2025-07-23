#!/usr/bin/env node

/**
 * Migration script to move from filesystem/per-type NeDB to global NeDB databases
 * This script migrates all data to two global databases: document-types.db and documents.db
 */

const fs = require('fs').promises
const path = require('path')
const Datastore = require('@seald-io/nedb')

const DATA_DIR = process.env.DATA_DIR || './data'

// Create global databases
function createDocumentTypesDB() {
  const dbPath = path.join(DATA_DIR, 'document-types.jsonl')
  const db = new Datastore({ filename: dbPath, autoload: true })

  // Create indexes
  db.ensureIndex({ fieldName: 'id', unique: true })
  db.ensureIndex({ fieldName: 'name' })
  db.ensureIndex({ fieldName: 'created_at' })

  return db
}

function createDocumentsDB() {
  const dbPath = path.join(DATA_DIR, 'documents.jsonl')
  const db = new Datastore({ filename: dbPath, autoload: true })

  // Create indexes
  db.ensureIndex({ fieldName: 'status' })
  db.ensureIndex({ fieldName: 'uploaded_at' })
  db.ensureIndex({ fieldName: 'document_type_id' })
  db.ensureIndex({ fieldName: 'id', unique: true })

  return db
}

async function migrateDocumentType(typeName, typesDB, docsDB) {
  console.log(`\n🔄 Migrating document type: ${typeName}`)

  const typeDir = path.join(DATA_DIR, 'document-types', typeName)
  const configPath = path.join(typeDir, 'config.json')

  try {
    // Migrate document type
    const configData = await fs.readFile(configPath, 'utf-8')
    const documentType = JSON.parse(configData)

    // Check if already migrated
    const existing = await new Promise((resolve, reject) => {
      typesDB.findOne({ id: documentType.id }, (err, doc) => {
        if (err) reject(err)
        else resolve(doc)
      })
    })

    if (!existing) {
      await new Promise((resolve, reject) => {
        typesDB.insert(documentType, (err, newDoc) => {
          if (err) reject(err)
          else resolve(newDoc)
        })
      })
      console.log(`   ✅ Migrated document type: ${documentType.name}`)
    } else {
      console.log(`   ℹ️  Document type already exists: ${documentType.name}`)
    }

    // Migrate documents
    const documentsDir = path.join(typeDir, 'documents')
    try {
      const docIds = await fs.readdir(documentsDir)
      let migratedCount = 0

      for (const docId of docIds) {
        const docDir = path.join(documentsDir, docId)
        const metadataPath = path.join(docDir, 'metadata.json')
        const dataPath = path.join(docDir, 'data.json')

        try {
          // Check if already migrated
          const existingDoc = await new Promise((resolve, reject) => {
            docsDB.findOne({ id: docId }, (err, doc) => {
              if (err) reject(err)
              else resolve(doc)
            })
          })

          if (existingDoc) continue

          // Read metadata
          const metadataContent = await fs.readFile(metadataPath, 'utf-8')
          const metadata = JSON.parse(metadataContent)

          // Read file content
          const fileExt = path.extname(metadata.original_filename)
          const filePath = path.join(docDir, `file${fileExt}`)
          let fileContent = ''
          let fileSize = 0

          try {
            const fileBuffer = await fs.readFile(filePath)
            fileContent = fileBuffer.toString('base64')
            fileSize = fileBuffer.length
          } catch {
            console.warn(`     ⚠️  File not found for document ${docId}`)
          }

          // Read extracted data if exists
          let extractedData = null
          let schemaSnapshot = null
          try {
            const dataContent = await fs.readFile(dataPath, 'utf-8')
            const data = JSON.parse(dataContent)
            extractedData = data.extracted_data
            schemaSnapshot = data.schema_snapshot
          } catch {
            // No extracted data
          }

          // Determine MIME type
          const ext = path.extname(metadata.original_filename).toLowerCase()
          const mimeTypes = {
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
          const mimeType = mimeTypes[ext] || 'application/octet-stream'

          // Create document record
          const documentRecord = {
            id: metadata.id,
            document_type_id: metadata.document_type_id,
            status: metadata.status,
            original_filename: metadata.original_filename,
            uploaded_at: metadata.uploaded_at,
            processed_at: metadata.processed_at,
            file_size: fileSize,
            mime_type: mimeType,
            file_content: fileContent,
            extracted_data: extractedData,
            schema_snapshot: schemaSnapshot,
          }

          await new Promise((resolve, reject) => {
            docsDB.insert(documentRecord, (err, newDoc) => {
              if (err) reject(err)
              else resolve(newDoc)
            })
          })

          migratedCount++
        } catch (error) {
          console.warn(`     ⚠️  Failed to migrate document ${docId}:`, error.message)
        }
      }

      if (migratedCount > 0) {
        console.log(`   ✅ Migrated ${migratedCount} documents`)
      }
    } catch {
      console.log(`   ℹ️  No documents directory found`)
    }
  } catch (error) {
    console.warn(`   ❌ Failed to migrate document type ${typeName}:`, error.message)
  }
}

async function main() {
  console.log('🚀 Starting migration to global NeDB databases...')

  try {
    // Ensure data directory exists
    await fs.mkdir(DATA_DIR, { recursive: true })

    // Create global databases
    const typesDB = createDocumentTypesDB()
    const docsDB = createDocumentsDB()

    const typesDir = path.join(DATA_DIR, 'document-types')

    // Check if old filesystem structure exists
    try {
      await fs.access(typesDir)
    } catch {
      console.log('ℹ️  No filesystem structure found to migrate')
      return
    }

    const typeNames = await fs.readdir(typesDir)

    if (typeNames.length === 0) {
      console.log('ℹ️  No document types found to migrate')
      return
    }

    console.log(`📁 Found ${typeNames.length} document type(s) to migrate`)

    for (const typeName of typeNames) {
      await migrateDocumentType(typeName, typesDB, docsDB)
    }

    console.log('\n✨ Migration completed!')
    console.log('\n📝 Next steps:')
    console.log('   1. Test your application to ensure everything works correctly')
    console.log('   2. Once confirmed, you can remove the old filesystem structure')
    console.log('   3. All data is now stored in global NeDB databases:')
    console.log(`      - ${path.join(DATA_DIR, 'document-types.db')}`)
    console.log(`      - ${path.join(DATA_DIR, 'documents.db')}`)
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  }
}

// Run the migration
main().catch(console.error)
