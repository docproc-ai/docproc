# Global NeDB Migration Guide

This document explains the migration from filesystem-based storage to a global NeDB database approach for the AI Document Processor.

## Overview

The AI Document Processor has been completely restructured to use **two global NeDB databases** instead of individual files and per-type databases:

1. **`data/document-types.db`** - Stores all document type configurations
2. **`data/documents.db`** - Stores all document metadata, extracted data, and file content (as base64)

## Architecture Changes

### Before (Filesystem + Per-Type NeDB)
```
data/
└── document-types/
    └── {type-id}/
        ├── config.json           # Document type config
        ├── documents.db          # Per-type NeDB database
        └── documents/
            └── {doc-id}/
                ├── metadata.json # Document metadata
                ├── data.json     # Extracted data
                └── file.{ext}    # Original file
```

### After (Global NeDB)
```
data/
├── document-types.db             # Global document types database
├── documents.db                  # Global documents database
└── document-types/               # Legacy (can be removed after migration)
    └── ...
```

## Benefits of Global NeDB Approach

### 1. **Simplified Architecture**
- **Single source of truth**: All data in two databases
- **No file management**: Everything stored in databases
- **Atomic operations**: Database transactions ensure consistency
- **Cross-type queries**: Query documents across all types

### 2. **Enhanced Performance**
- **Fast lookups**: Direct document access by ID without type context
- **Efficient counting**: Database-level document counts
- **Bulk operations**: Update multiple documents atomically
- **Indexed queries**: Fast filtering by status, date, type, etc.

### 3. **Improved Scalability**
- **Memory efficient**: NeDB loads only what's needed
- **Concurrent access**: Better handling of simultaneous operations
- **Backup simplicity**: Just two database files to backup
- **Migration ready**: Easy to move to other databases later

## Database Schemas

### Document Types Database (`document-types.db`)
```javascript
{
  _id: "0MdTWxD4fEFg1aK8",              // NeDB internal ID
  id: "invoices",                       // Slugified document type ID
  name: "Invoice Processing",           // Human-readable name
  schema: {                             // JSON Schema for validation
    type: "object",
    properties: {
      invoice_number: { type: "string" },
      total_amount: { type: "number" }
    },
    required: ["invoice_number", "total_amount"]
  },
  webhook_url: "https://api.example.com/webhook",  // Optional
  webhook_method: "POST",               // Optional: POST | PUT
  created_at: "2025-01-01T00:00:00Z"
}
```

**Indexes:**
- `id` (unique) - Fast document type lookups
- `name` - Search by name
- `created_at` - Sort by creation date

### Documents Database (`documents.db`)
```javascript
{
  _id: "I8yEevIh0Cv7M34g",              // NeDB internal ID
  id: "doc-1753209711622-82ond912z",    // Our document ID
  document_type_id: "invoices",         // Reference to document type
  status: "approved",                   // pending | approved | rejected | processing_failed
  original_filename: "invoice.pdf",
  uploaded_at: "2025-01-01T00:00:00Z",
  processed_at: "2025-01-01T00:05:00Z", // Optional
  file_size: 92872,                     // File size in bytes
  mime_type: "application/pdf",         // Detected MIME type
  file_content: "JVBERi0xLjQKJcOkw7...", // Base64 encoded file content
  extracted_data: {                     // Extracted data from AI processing
    invoice_number: "INV-001",
    total_amount: 1500
  },
  schema_snapshot: {                    // Schema used during processing
    type: "object",
    properties: {
      invoice_number: { type: "string" },
      total_amount: { type: "number" }
    }
  }
}
```

**Indexes:**
- `id` (unique) - Fast document lookups
- `document_type_id` - Filter by document type
- `status` - Filter by processing status
- `uploaded_at` - Sort by upload date

## API Improvements

### Document Types API
```javascript
// GET /api/document-types
// Returns all document types with accurate document counts
[
  {
    id: "invoices",
    name: "Invoice Processing",
    schema: { ... },
    document_count: 42  // Real-time count from documents database
  }
]
```

### Documents API
```javascript
// GET /api/documents?documentTypeId=invoices
// Fast filtering by document type
[
  {
    id: "doc-123",
    document_type_id: "invoices",
    status: "approved",
    storage_path: "/api/documents/doc-123/file",
    extracted_data: { ... },
    schema_snapshot: { ... }
  }
]

// GET /api/documents/doc-123/file
// Direct file access without document type context
// Returns file content from base64 storage
```

## Migration Process

### Automatic Migration
Run the migration script to move from the old structure:

```bash
node scripts/migrate-to-global-nedb.js
```

The script will:
1. Create global `document-types.db` and `documents.db`
2. Migrate all document type configurations
3. Migrate all document metadata and files
4. Convert files to base64 and store in database
5. Preserve original filesystem structure as backup

### Migration Output
```
🚀 Starting migration to global NeDB databases...
📁 Found 4 document type(s) to migrate

🔄 Migrating document type: invoices
   ✅ Migrated document type: Invoice Processing
   ✅ Migrated 15 documents

✨ Migration completed!
```

## Performance Comparisons

### Before (Filesystem)
```javascript
// Get documents - had to read multiple files
const documents = []
for (const docId of docIds) {
  const metadata = JSON.parse(await fs.readFile(`${docId}/metadata.json`))
  const data = JSON.parse(await fs.readFile(`${docId}/data.json`))
  documents.push({ ...metadata, ...data })
}
```

### After (Global NeDB)
```javascript
// Get documents - single database query
const documents = await docsDb.findByDocumentType('invoices')
```

### Document Counting
```javascript
// Before: Count files in directory
const docIds = await fs.readdir(documentsDir)
const count = docIds.length

// After: Database count query
const count = await docsDb.countByDocumentType('invoices')
```

## Advanced Queries

With global NeDB, you can now perform complex queries:

```javascript
// Find all pending documents across all types
const pending = await docsDb.find({ status: 'pending' })

// Find documents uploaded in the last 24 hours
const recent = await docsDb.find({
  uploaded_at: { $gte: new Date(Date.now() - 24*60*60*1000).toISOString() }
})

// Find large documents (>1MB)
const large = await docsDb.find({ file_size: { $gt: 1024*1024 } })

// Bulk approve documents
await docsDb.updateStatus(['doc-1', 'doc-2', 'doc-3'], 'approved')
```

## File Storage

### Base64 Encoding
Files are stored as base64 strings in the database:
- **Pros**: No file system dependencies, atomic operations, easy backup
- **Cons**: ~33% size increase, memory usage for large files
- **Suitable for**: Documents up to ~10MB (typical business documents)

### Memory Considerations
- NeDB loads entire database into memory
- Monitor memory usage with large document collections
- Consider pagination for very large datasets (>1000 documents)

## Backup and Maintenance

### Simple Backup
```bash
# Backup both databases
cp data/document-types.db backup/document-types-$(date +%Y%m%d).db
cp data/documents.db backup/documents-$(date +%Y%m%d).db
```

### Database Size Monitoring
```bash
# Check database sizes
ls -lh data/*.db
```

### Cleanup Old Structure
After confirming the migration works:
```bash
# Remove old filesystem structure
rm -rf data/document-types/
```

## Troubleshooting

### Migration Issues
```bash
# Re-run migration if needed
node scripts/migrate-to-global-nedb.js
```

### Database Corruption
```bash
# Restore from backup
cp backup/documents-20250122.db data/documents.db
cp backup/document-types-20250122.db data/document-types.db
```

### Performance Issues
- Monitor memory usage: `ps aux | grep node`
- Check database sizes: `ls -lh data/*.db`
- Consider pagination for large result sets

## Future Enhancements

With global NeDB in place, we can easily add:

1. **Cross-Type Analytics**: Document processing metrics across all types
2. **Advanced Search**: Full-text search across document metadata
3. **Bulk Operations**: Mass approve/reject workflows
4. **Document Relationships**: Link related documents
5. **Audit Trails**: Track all document changes
6. **Export/Import**: Easy data migration tools

## Dependencies

- **@seald-io/nedb**: Modern NeDB implementation
- **No filesystem dependencies**: Everything in databases
- **Backward compatible**: Migration preserves all data

The global NeDB approach provides a robust, scalable foundation for the AI Document Processor while maintaining simplicity and reliability.
