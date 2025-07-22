/**
 * Migration script to convert from database storage to filesystem storage
 * 
 * This script is for reference only - you would need to adapt it to your specific database setup
 * and run it with appropriate database credentials.
 * 
 * Usage: node scripts/migrate-to-filesystem.js
 */

const fs = require('fs').promises;
const path = require('path');

// You would need to install and configure your database client here
// const { neon } = require("@neondatabase/serverless");
// const sql = neon(process.env.DATABASE_URL);

const DATA_DIR = process.env.DATA_DIR || './data';

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function ensureDataDir() {
  const documentTypesDir = path.join(DATA_DIR, 'document-types');
  await fs.mkdir(documentTypesDir, { recursive: true });
}

async function migrateDocumentTypes() {
  console.log('Migrating document types...');
  
  // Example query - adapt to your database
  // const documentTypes = await sql`SELECT * FROM "DocumentTypes" ORDER BY created_at`;
  
  // For demonstration, using mock data
  const documentTypes = [
    {
      id: 'uuid-1',
      name: 'Invoice',
      schema: { type: 'object', properties: { amount: { type: 'number' } } },
      webhook_url: null,
      webhook_method: 'POST',
      created_at: '2025-01-01T00:00:00Z'
    }
  ];
  
  for (const docType of documentTypes) {
    const slugId = slugify(docType.name);
    const typeDir = path.join(DATA_DIR, 'document-types', slugId);
    const documentsDir = path.join(typeDir, 'documents');
    
    // Create directories
    await fs.mkdir(documentsDir, { recursive: true });
    
    // Save config
    const config = {
      id: slugId,
      name: docType.name,
      schema: docType.schema,
      webhook_url: docType.webhook_url || undefined,
      webhook_method: docType.webhook_method || 'POST',
      created_at: docType.created_at
    };
    
    const configPath = path.join(typeDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    
    console.log(`Migrated document type: ${docType.name} -> ${slugId}`);
    
    // Migrate documents for this type
    await migrateDocuments(docType.id, slugId);
  }
}

async function migrateDocuments(originalTypeId, newTypeId) {
  console.log(`Migrating documents for type: ${newTypeId}`);
  
  // Example query - adapt to your database
  // const documents = await sql`SELECT * FROM "Documents" WHERE document_type_id = ${originalTypeId}`;
  
  // For demonstration, using mock data
  const documents = [];
  
  for (const doc of documents) {
    const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const docDir = path.join(DATA_DIR, 'document-types', newTypeId, 'documents', docId);
    
    // Create document directory
    await fs.mkdir(docDir, { recursive: true });
    
    // Save metadata
    const metadata = {
      id: docId,
      document_type_id: newTypeId,
      status: doc.status,
      original_filename: doc.original_filename,
      uploaded_at: doc.uploaded_at,
      processed_at: doc.processed_at
    };
    
    const metadataPath = path.join(docDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    // Save extracted data if it exists
    if (doc.extracted_data || doc.schema_snapshot) {
      const data = {
        extracted_data: doc.extracted_data,
        schema_snapshot: doc.schema_snapshot,
        processed_at: doc.processed_at
      };
      
      const dataPath = path.join(docDir, 'data.json');
      await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
    }
    
    // Download and save the actual file from blob storage
    if (doc.storage_path) {
      try {
        const response = await fetch(doc.storage_path);
        if (response.ok) {
          const fileBuffer = await response.arrayBuffer();
          const fileExt = path.extname(doc.original_filename);
          const filePath = path.join(docDir, `file${fileExt}`);
          await fs.writeFile(filePath, Buffer.from(fileBuffer));
          console.log(`Downloaded file: ${doc.original_filename}`);
        }
      } catch (error) {
        console.error(`Failed to download file ${doc.original_filename}:`, error);
      }
    }
    
    console.log(`Migrated document: ${doc.original_filename} -> ${docId}`);
  }
}

async function main() {
  try {
    console.log('Starting migration to filesystem...');
    console.log(`Data directory: ${DATA_DIR}`);
    
    await ensureDataDir();
    await migrateDocumentTypes();
    
    console.log('Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Update your environment variables to remove DATABASE_URL');
    console.log('2. Test the application with the new filesystem storage');
    console.log('3. Remove database dependencies from package.json');
    console.log('4. Delete the old database tables once you\'re confident everything works');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Uncomment to run the migration
// main();

console.log('Migration script loaded. Uncomment main() call to run migration.');
console.log('Make sure to configure your database connection first!');
