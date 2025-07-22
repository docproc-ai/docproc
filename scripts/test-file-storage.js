#!/usr/bin/env node

/**
 * Test script to verify that file uploads are stored in filesystem instead of base64
 */

const fs = require('fs').promises
const path = require('path')

async function testFileStorage() {
  console.log('🧪 Testing file storage system...')
  
  try {
    // Check if data directory structure exists
    const dataDir = './data'
    const filesDir = path.join(dataDir, 'files')
    
    console.log('\n📁 Checking directory structure:')
    
    try {
      await fs.access(dataDir)
      console.log(`   ✅ Data directory exists: ${dataDir}`)
    } catch {
      console.log(`   ❌ Data directory missing: ${dataDir}`)
      return
    }
    
    try {
      await fs.access(filesDir)
      console.log(`   ✅ Files directory exists: ${filesDir}`)
    } catch {
      console.log(`   ⚠️  Files directory missing: ${filesDir}`)
      console.log('   📝 This is normal if no files have been uploaded yet')
    }
    
    // Check database files
    const documentsDb = path.join(dataDir, 'documents.jsonl')
    const documentTypesDb = path.join(dataDir, 'document-types.jsonl')
    
    try {
      await fs.access(documentsDb)
      console.log(`   ✅ Documents database exists: ${documentsDb}`)
    } catch {
      console.log(`   ❌ Documents database missing: ${documentsDb}`)
    }
    
    try {
      await fs.access(documentTypesDb)
      console.log(`   ✅ Document types database exists: ${documentTypesDb}`)
    } catch {
      console.log(`   ❌ Document types database missing: ${documentTypesDb}`)
    }
    
    // Check if there are any documents in the database
    try {
      const dbContent = await fs.readFile(documentsDb, 'utf-8')
      const lines = dbContent.split('\n').filter(line => line.trim() && !line.includes('$$indexCreated'))
      
      console.log(`\n📄 Found ${lines.length} document(s) in database`)
      
      if (lines.length > 0) {
        console.log('\n🔍 Checking document storage format:')
        
        for (let i = 0; i < Math.min(lines.length, 3); i++) {
          try {
            const doc = JSON.parse(lines[i])
            console.log(`\n   Document ${i + 1}: ${doc.id}`)
            console.log(`      Original filename: ${doc.original_filename}`)
            console.log(`      File size: ${doc.file_size} bytes`)
            
            if (doc.file_content) {
              console.log(`      ❌ ISSUE: Document still contains base64 content (${doc.file_content.length} chars)`)
            } else if (doc.file_path) {
              console.log(`      ✅ Document uses file storage: ${doc.file_path}`)
              
              // Check if the file actually exists
              const fullPath = path.join(dataDir, doc.file_path)
              try {
                await fs.access(fullPath)
                const stats = await fs.stat(fullPath)
                console.log(`      ✅ File exists on disk: ${stats.size} bytes`)
              } catch {
                console.log(`      ❌ File missing on disk: ${fullPath}`)
              }
            } else {
              console.log(`      ⚠️  Document has no file storage information`)
            }
          } catch (error) {
            console.log(`      ❌ Error parsing document: ${error.message}`)
          }
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Could not read documents database: ${error.message}`)
    }
    
    // Check files directory structure
    try {
      const filesDirContents = await fs.readdir(filesDir, { withFileTypes: true })
      const documentTypeDirs = filesDirContents.filter(entry => entry.isDirectory())
      
      console.log(`\n📂 Found ${documentTypeDirs.length} document type folder(s) in files directory:`)
      
      for (const dir of documentTypeDirs) {
        console.log(`   📁 ${dir.name}/`)
        
        try {
          const typeFiles = await fs.readdir(path.join(filesDir, dir.name))
          console.log(`      📄 ${typeFiles.length} file(s)`)
          
          // Show first few files
          for (let i = 0; i < Math.min(typeFiles.length, 3); i++) {
            const filePath = path.join(filesDir, dir.name, typeFiles[i])
            const stats = await fs.stat(filePath)
            console.log(`         ${typeFiles[i]} (${stats.size} bytes)`)
          }
          
          if (typeFiles.length > 3) {
            console.log(`         ... and ${typeFiles.length - 3} more`)
          }
        } catch (error) {
          console.log(`      ❌ Error reading directory: ${error.message}`)
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Could not read files directory: ${error.message}`)
    }
    
    console.log('\n✨ File storage test completed!')
    console.log('\n📝 Summary:')
    console.log('   - Documents should use file_path instead of file_content')
    console.log('   - Files should be stored in data/files/{document_type_id}/')
    console.log('   - Database should be much smaller without base64 content')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    process.exit(1)
  }
}

// Run the test
testFileStorage().catch(console.error)
