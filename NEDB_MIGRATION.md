# NeDB Migration Guide

This document explains the migration from individual JSON metadata files to NeDB for improved performance and querying capabilities.

## Overview

The AI Document Processor has been upgraded to use **@seald-io/nedb** for document metadata storage while maintaining the existing file-based storage for document content and extracted data.

### What Changed

**Before (JSON Files):**
```
data/document-types/{type-id}/documents/{doc-id}/
├── metadata.json     # Document metadata
├── data.json         # Extracted data + schema
└── file.{ext}        # Original document file
```

**After (NeDB + Files):**
```
data/document-types/{type-id}/
├── config.json       # Document type configuration
├── documents.db      # NeDB database for all document metadata
└── documents/        # Document files and extracted data
    └── {doc-id}/
        ├── data.json     # Extracted data + schema
        └── file.{ext}    # Original document file
```

## Benefits of NeDB

### 1. **Performance Improvements**
- **Fast queries**: MongoDB-style queries with indexing
- **Bulk operations**: Update multiple documents at once
- **Efficient filtering**: Filter by status, date range, etc.
- **Sorting and pagination**: Built-in support

### 2. **Better Data Management**
- **Atomic operations**: No more race conditions
- **Indexing**: Automatic indexes on `status`, `uploaded_at`, and `id`
- **Rich metadata**: File size, MIME type, and more
- **Consistent queries**: Familiar MongoDB syntax

### 3. **Enhanced Features**
- **Status filtering**: `db.find({ status: 'pending' })`
- **Date range queries**: `db.find({ uploaded_at: { $gte: startDate } })`
- **Document counting**: Fast document counts per type
- **Bulk status updates**: Approve/reject multiple documents

## Migration Process

### Automatic Migration

The application automatically migrates existing JSON metadata files to NeDB when:
1. A document type is accessed for the first time
2. The `getDocuments()` function is called
3. No existing NeDB file is found

### Manual Migration

You can also run the migration script manually:

```bash
node scripts/migrate-to-nedb.js
```

This script will:
- Check all document types for existing NeDB files
- Migrate JSON metadata to NeDB format
- Preserve original files as backup
- Add rich metadata (file size, MIME type)
- Create proper indexes

## Database Schema

### NeDB Document Record
```javascript
{
  _id: "0MdTWxD4fEFg1aK8",              // NeDB internal ID
  id: "doc-1753206787473-i7kufo0ak",    // Our document ID
  document_type_id: "invoices",
  status: "approved",                    // pending | approved | rejected | processing_failed
  original_filename: "invoice.pdf",
  uploaded_at: "2025-01-01T00:00:00Z",
  processed_at: "2025-01-01T00:05:00Z", // Optional
  file_size: 92872,                     // File size in bytes
  mime_type: "application/pdf"          // Detected MIME type
}
```

### Indexes Created
- `status` - For filtering by document status
- `uploaded_at` - For date-based queries and sorting
- `id` (unique) - For fast document lookups

## API Performance Improvements

### Before (JSON Files)
```javascript
// Had to read every metadata.json file
const documents = []
for (const docId of docIds) {
  const metadata = JSON.parse(await fs.readFile(`${docId}/metadata.json`))
  documents.push(metadata)
}
```

### After (NeDB)
```javascript
// Single database query with sorting and filtering
const documents = await db.find({ status: 'pending' })
  .sort({ uploaded_at: -1 })
  .limit(10)
```

## Query Examples

### Find Pending Documents
```javascript
const db = new DocumentDatabase('invoices')
const pending = await db.findByStatus('pending')
```

### Count Documents by Status
```javascript
const pendingCount = await db.count({ status: 'pending' })
const approvedCount = await db.count({ status: 'approved' })
```

### Bulk Status Update
```javascript
const docIds = ['doc-1', 'doc-2', 'doc-3']
const updated = await db.updateStatus(docIds, 'approved')
```

### Date Range Queries
```javascript
const recentDocs = await db.find({
  uploaded_at: { 
    $gte: '2025-01-01T00:00:00Z',
    $lte: '2025-01-31T23:59:59Z'
  }
})
```

## File Structure After Migration

```
data/
└── document-types/
    └── invoices/
        ├── config.json           # Document type configuration
        ├── documents.db          # NeDB database (NEW)
        └── documents/
            ├── doc-123/
            │   ├── data.json     # Extracted data + schema
            │   ├── file.pdf      # Original document
            │   └── metadata.json # Backup (preserved)
            └── doc-456/
                ├── data.json
                ├── file.pdf
                └── metadata.json # Backup (preserved)
```

## Backward Compatibility

- **Original files preserved**: All `metadata.json` files are kept as backup
- **Gradual migration**: Only migrates when document types are accessed
- **Fallback support**: Can still read from JSON files if NeDB fails
- **No breaking changes**: All existing APIs continue to work

## Troubleshooting

### Migration Issues

**Problem**: Migration script fails with permission errors
```bash
# Solution: Check file permissions
chmod +x scripts/migrate-to-nedb.js
```

**Problem**: NeDB file corruption
```bash
# Solution: Delete .db file and re-run migration
rm data/document-types/{type-id}/documents.db
node scripts/migrate-to-nedb.js
```

### Performance Issues

**Problem**: Slow queries
```javascript
// Solution: Ensure indexes are created
db.ensureIndex({ fieldName: 'status' })
db.ensureIndex({ fieldName: 'uploaded_at' })
```

**Problem**: Memory usage
- NeDB loads entire database into memory
- For very large datasets (>10,000 documents), consider pagination
- Monitor memory usage in production

## Monitoring and Maintenance

### Database Size
```bash
# Check NeDB file sizes
find data -name "documents.db" -exec ls -lh {} \;
```

### Index Status
```javascript
// Check if indexes exist
const db = new DocumentDatabase('invoices')
// Indexes are automatically created on first access
```

### Backup Strategy
```bash
# Backup NeDB files
cp -r data/document-types/ backup/$(date +%Y%m%d)/
```

## Future Enhancements

With NeDB in place, we can now easily add:

1. **Advanced Filtering**: Complex queries with multiple conditions
2. **Analytics**: Document processing statistics and trends
3. **Bulk Operations**: Mass approve/reject workflows
4. **Search**: Full-text search across document metadata
5. **Reporting**: Generate reports on document processing metrics

## Dependencies

- **@seald-io/nedb**: Modern, actively maintained NeDB fork
- **File System**: Continues to use filesystem for document content
- **Backward Compatible**: Works with existing JSON metadata

The migration provides significant performance improvements while maintaining the simplicity and reliability of file-based storage for document content.
