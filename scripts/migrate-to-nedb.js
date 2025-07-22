#!/usr/bin/env node

/**
 * Migration script to convert JSON metadata files to NeDB
 * This script migrates existing document metadata from individual JSON files to NeDB databases
 */

const fs = require('fs').promises
const path = require('path')

const DATA_DIR = process.env.DATA_DIR || './data'

async function migrateDocumentType(documentTypeId) {
  console.log(`\n🔄 Migrating document type: ${documentTypeId}`)
  
  const documentsDir = path.join(DATA_DIR, 'document-types', documentTypeId, 'documents')
  const dbPath = path.join(DATA_DIR, 'document-types', documentTypeId, 'documents.db')
  
  // Check if NeDB file already exists
  try {
    await fs.access(dbPath)
    console.log(`⚠️  NeDB file already exists: ${dbPath}`)
    console.log(`   Skipping migration for ${documentTypeId}`)
    return
  } catch {
    // NeDB file doesn't exist, proceed with migration
  }
  
  try {
    const docIds = await fs.readdir(documentsDir)
    let migratedCount = 0
    let skippedCount = 0
    
    // Create NeDB records
    const records = []
    
    for (const docId of docIds) {
      const metadataPath = path.join(documentsDir, docId, 'metadata.json')
      
      try {
        // Read metadata from JSON file
        const metadataContent = await fs.readFile(metadataPath, 'utf-8')
        const metadata = JSON.parse(metadataContent)
        
        // Get file stats for additional metadata
        const filePath = path.join(documentsDir, docId, `file${path.extname(metadata.original_filename)}`)
        let fileSize = 0
        let mimeType = 'application/octet-stream'
        
        try {
          const stats = await fs.stat(filePath)
          fileSize = stats.size
          
          // Determine MIME type from extension
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
            '.tif': 'image/tiff'
          }
          mimeType = mimeTypes[ext] || 'application/octet-stream'
        } catch {
          // File might not exist, continue with defaults
        }
        
        // Create NeDB record
        const record = {
          id: metadata.id,
          document_type_id: metadata.document_type_id,
          status: metadata.status,
          original_filename: metadata.original_filename,
          uploaded_at: metadata.uploaded_at,
          processed_at: metadata.processed_at,
          file_size: fileSize,
          mime_type: mimeType,
          _id: generateNeDBId()
        }
        
        records.push(record)
        migratedCount++
        
      } catch (error) {
        console.warn(`   ⚠️  Failed to migrate document ${docId}:`, error.message)
        skippedCount++
      }
    }
    
    if (records.length > 0) {
      // Write NeDB file
      const nedbContent = [
        // Index creation records
        '{"$$indexCreated":{"fieldName":"status","unique":false,"sparse":false}}',
        '{"$$indexCreated":{"fieldName":"uploaded_at","unique":false,"sparse":false}}',
        '{"$$indexCreated":{"fieldName":"id","unique":true,"sparse":false}}',
        // Document records
        ...records.map(record => JSON.stringify(record))
      ].join('\n') + '\n'
      
      await fs.writeFile(dbPath, nedbContent)
      console.log(`   ✅ Migrated ${migratedCount} documents to NeDB`)
      
      if (skippedCount > 0) {
        console.log(`   ⚠️  Skipped ${skippedCount} documents due to errors`)
      }
      
      // Optionally backup old metadata files
      console.log(`   💡 Original metadata.json files are preserved for backup`)
    } else {
      console.log(`   ℹ️  No documents found to migrate`)
    }
    
  } catch (error) {
    console.error(`   ❌ Failed to migrate document type ${documentTypeId}:`, error.message)
  }
}

function generateNeDBId() {
  // Generate a simple NeDB-style ID
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

async function main() {
  console.log('🚀 Starting migration from JSON metadata to NeDB...')
  
  const typesDir = path.join(DATA_DIR, 'document-types')
  
  try {
    const documentTypes = await fs.readdir(typesDir)
    
    if (documentTypes.length === 0) {
      console.log('ℹ️  No document types found to migrate')
      return
    }
    
    console.log(`📁 Found ${documentTypes.length} document type(s) to check`)
    
    for (const documentTypeId of documentTypes) {
      await migrateDocumentType(documentTypeId)
    }
    
    console.log('\n✨ Migration completed!')
    console.log('\n📝 Next steps:')
    console.log('   1. Test your application to ensure everything works correctly')
    console.log('   2. Once confirmed, you can optionally remove the old metadata.json files')
    console.log('   3. The NeDB files (.db) contain all document metadata with improved performance')
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  }
}

// Run the migration
main().catch(console.error)
