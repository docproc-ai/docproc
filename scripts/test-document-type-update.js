#!/usr/bin/env node

/**
 * Test script to verify document type update functionality
 */

const fs = require('fs').promises
const path = require('path')

async function testDocumentTypeUpdate() {
  console.log('🧪 Testing document type update functionality...')
  
  try {
    // Check if document types database exists
    const dataDir = './data'
    const documentTypesDb = path.join(dataDir, 'document-types.jsonl')
    
    try {
      await fs.access(documentTypesDb)
      console.log(`   ✅ Document types database exists: ${documentTypesDb}`)
    } catch {
      console.log(`   ❌ Document types database missing: ${documentTypesDb}`)
      return
    }
    
    // Read and parse document types
    const dbContent = await fs.readFile(documentTypesDb, 'utf-8')
    const lines = dbContent.split('\n').filter(line => line.trim() && !line.includes('$$indexCreated'))
    
    console.log(`\n📄 Found ${lines.length} document type(s) in database`)
    
    if (lines.length === 0) {
      console.log('   ⚠️  No document types found to test')
      return
    }
    
    // Show first document type
    try {
      const docType = JSON.parse(lines[0])
      console.log(`\n🔍 First document type:`)
      console.log(`   ID: ${docType.id}`)
      console.log(`   Name: ${docType.name}`)
      console.log(`   Schema: ${JSON.stringify(docType.schema).substring(0, 100)}...`)
      console.log(`   Webhook URL: ${docType.webhook_url || 'None'}`)
      console.log(`   Webhook Method: ${docType.webhook_method || 'POST'}`)
      console.log(`   Created: ${docType.created_at}`)
      
      // Test API endpoint
      console.log(`\n🌐 Testing API endpoints...`)
      
      // Test GET endpoint
      console.log(`   Testing GET /api/document-types/${docType.id}`)
      try {
        const response = await fetch(`http://localhost:3001/api/document-types/${docType.id}`)
        if (response.ok) {
          const data = await response.json()
          console.log(`   ✅ GET request successful`)
          console.log(`      Response name: ${data.name}`)
        } else {
          console.log(`   ❌ GET request failed: ${response.status} ${response.statusText}`)
          const errorText = await response.text()
          console.log(`      Error: ${errorText}`)
        }
      } catch (error) {
        console.log(`   ❌ GET request error: ${error.message}`)
      }
      
      // Test PUT endpoint with minimal change
      console.log(`   Testing PUT /api/document-types/${docType.id}`)
      try {
        const updateData = {
          name: docType.name,
          schema: docType.schema,
          webhook_url: docType.webhook_url || '',
          webhook_method: docType.webhook_method || 'POST'
        }
        
        const response = await fetch(`http://localhost:3001/api/document-types/${docType.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log(`   ✅ PUT request successful`)
          console.log(`      Updated name: ${data.name}`)
        } else {
          console.log(`   ❌ PUT request failed: ${response.status} ${response.statusText}`)
          const errorText = await response.text()
          console.log(`      Error: ${errorText}`)
        }
      } catch (error) {
        console.log(`   ❌ PUT request error: ${error.message}`)
      }
      
    } catch (error) {
      console.log(`   ❌ Error parsing document type: ${error.message}`)
    }
    
    console.log('\n✨ Document type update test completed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    process.exit(1)
  }
}

// Run the test
testDocumentTypeUpdate().catch(console.error)
