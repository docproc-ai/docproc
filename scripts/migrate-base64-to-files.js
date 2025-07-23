#!/usr/bin/env node

/**
 * Migration script to convert base64 file content in NeDB to file storage
 * This script reads documents from the NeDB database, extracts base64 content,
 * saves it as files in the filesystem, and updates the database records
 */

const fs = require('fs').promises
const path = require('path')
const Datastore = require('@seald-io/nedb')
const { createHash } = require('crypto')

const DATA_DIR = process.env.DATA_DIR || './data'
const FILES_DIR = path.join(DATA_DIR, 'files')

// File storage utilities (copied from lib/file-storage.ts)
class FileStorage {
  static generateFilePath(documentTypeId, documentId, originalFilename) {
    const ext = path.extname(originalFilename)
    const baseName = path.basename(originalFilename, ext)

    // Structure: data/files/{document_type_id}/{document_id}_{original_name}{ext}
    return path.join(FILES_DIR, documentTypeId, `${documentId}_${baseName}${ext}`)
  }

  static calculateHash(content) {
    return createHash('sha256').update(content).digest('hex')
  }

  static async storeFile(documentTypeId, documentId, originalFilename, content) {
    const filePath = this.generateFilePath(documentTypeId, documentId, originalFilename)
    const fileHash = this.calculateHash(content)

    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    // Write file
    await fs.writeFile(filePath, content)

    return { filePath, fileHash }
  }

  static getRelativePath(absolutePath) {
    return path.relative(DATA_DIR, absolutePath)
  }
}

// Create database connections
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

async function migrateDocument(db, doc) {
  console.log(`\n🔄 Migrating document: ${doc.id}`)

  try {
    // Check if document already has file_path (already migrated)
    if (doc.file_path && !doc.file_content) {
      console.log(`   ℹ️  Document already migrated: ${doc.id}`)
      return { success: true, skipped: true }
    }

    // Check if document has base64 content to migrate
    if (!doc.file_content) {
      console.log(`   ⚠️  No file content found for document: ${doc.id}`)
      return { success: false, reason: 'No file content' }
    }

    // Convert base64 to buffer
    const content = Buffer.from(doc.file_content, 'base64')

    // Store file in filesystem
    const { filePath, fileHash } = await FileStorage.storeFile(
      doc.document_type_id,
      doc.id,
      doc.original_filename,
      content,
    )

    // Get relative path for database storage
    const relativePath = FileStorage.getRelativePath(filePath)

    // Update document record in database
    await new Promise((resolve, reject) => {
      db.update(
        { _id: doc._id },
        {
          $set: {
            file_path: relativePath,
            file_hash: fileHash,
            file_size: content.length,
          },
          $unset: {
            file_content: true, // Remove base64 content
          },
        },
        {},
        (err, numReplaced) => {
          if (err) reject(err)
          else resolve(numReplaced)
        },
      )
    })

    console.log(`   ✅ Migrated document: ${doc.id}`)
    console.log(`      File: ${relativePath}`)
    console.log(`      Hash: ${fileHash}`)
    console.log(`      Size: ${content.length} bytes`)

    return { success: true, filePath: relativePath, fileHash, size: content.length }
  } catch (error) {
    console.error(`   ❌ Failed to migrate document ${doc.id}:`, error.message)
    return { success: false, reason: error.message }
  }
}

async function main() {
  console.log('🚀 Starting migration from base64 content to file storage...')

  try {
    // Ensure files directory exists
    await fs.mkdir(FILES_DIR, { recursive: true })

    // Create database connection
    const db = createDocumentsDB()

    // Get all documents with base64 content
    const documents = await new Promise((resolve, reject) => {
      db.find({ file_content: { $exists: true } }, (err, docs) => {
        if (err) reject(err)
        else resolve(docs)
      })
    })

    if (documents.length === 0) {
      console.log('ℹ️  No documents with base64 content found to migrate')
      return
    }

    console.log(`📁 Found ${documents.length} document(s) with base64 content to migrate`)

    let migratedCount = 0
    let skippedCount = 0
    let failedCount = 0
    let totalSizeSaved = 0

    for (const doc of documents) {
      const result = await migrateDocument(db, doc)

      if (result.success) {
        if (result.skipped) {
          skippedCount++
        } else {
          migratedCount++
          totalSizeSaved += result.size || 0
        }
      } else {
        failedCount++
      }
    }

    console.log('\n✨ Migration completed!')
    console.log(`   📊 Results:`)
    console.log(`      ✅ Migrated: ${migratedCount}`)
    console.log(`      ⏭️  Skipped: ${skippedCount}`)
    console.log(`      ❌ Failed: ${failedCount}`)
    console.log(`      💾 Total size: ${(totalSizeSaved / 1024 / 1024).toFixed(2)} MB`)

    if (migratedCount > 0) {
      console.log('\n📝 Next steps:')
      console.log('   1. Test your application to ensure file access works correctly')
      console.log('   2. Verify that files are properly stored in the data/files/ directory')
      console.log('   3. Check that the database no longer contains base64 content')
      console.log('   4. The database should now be much smaller!')
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  }
}

// Run the migration
main().catch(console.error)
