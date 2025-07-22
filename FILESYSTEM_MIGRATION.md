# Filesystem Migration Guide

This document explains the migration from database storage to filesystem storage for the AI Document Processor.

## New Architecture

The application now uses a filesystem-based approach with three types of files:

### Directory Structure

```
data/
├── document-types/
│   ├── invoice/
│   │   ├── config.json          # Document type definition
│   │   └── documents/           # All documents of this type
│   │       ├── doc-001/
│   │       │   ├── metadata.json    # Document metadata
│   │       │   ├── data.json        # Extracted data
│   │       │   └── file.pdf         # Original file
│   │       └── doc-002/
│   │           ├── metadata.json
│   │           ├── data.json
│   │           └── file.png
│   └── receipt/
│       ├── config.json
│       └── documents/
│           └── doc-003/
│               ├── metadata.json
│               ├── data.json
│               └── file.pdf
```

## File Types

### 1. Document Types (`config.json`)
Contains the document type definition including schema and webhook configuration.

```json
{
  "id": "invoice",
  "name": "Invoice",
  "schema": {
    "type": "object",
    "properties": {
      "invoice_number": { "type": "string" },
      "amount": { "type": "number" },
      "date": { "type": "string" }
    }
  },
  "webhook_url": "https://example.com/webhook",
  "webhook_method": "POST",
  "created_at": "2025-01-01T00:00:00Z"
}
```

### 2. Document Metadata (`metadata.json`)
Contains document metadata and status information.

```json
{
  "id": "doc-001",
  "document_type_id": "invoice",
  "status": "approved",
  "original_filename": "invoice-123.pdf",
  "uploaded_at": "2025-01-01T00:00:00Z",
  "processed_at": "2025-01-01T01:00:00Z"
}
```

### 3. Document Data (`data.json`)
Contains extracted data and schema snapshot.

```json
{
  "extracted_data": {
    "invoice_number": "INV-001",
    "amount": 1500.00,
    "date": "2025-01-01"
  },
  "schema_snapshot": {
    "type": "object",
    "properties": {
      "invoice_number": { "type": "string" },
      "amount": { "type": "number" },
      "date": { "type": "string" }
    }
  },
  "processed_at": "2025-01-01T01:00:00Z"
}
```

### 4. Document Files (`file.{ext}`)
The original uploaded files (PDFs, images, etc.) stored with their original extensions.

## Environment Variables

Add the following environment variable to your `.env` file:

```env
DATA_DIR=./data
```

## API Changes

### Document Processing
The process-document API now expects:
```json
{
  "model": "claude-3-haiku-20240307",
  "schema": { /* schema object */ },
  "documentTypeId": "invoice",
  "documentId": "doc-001"
}
```

### Document Operations
Some API endpoints now require additional headers:
- `x-document-type-id`: Required for document-specific operations

## Migration Steps

1. **Backup your existing data** before starting the migration.

2. **Update environment variables**:
   ```env
   DATA_DIR=./data
   # Remove DATABASE_URL if you had it
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Run migration script** (if you have existing data):
   ```bash
   node scripts/migrate-to-filesystem.js
   ```

5. **Test the application**:
   ```bash
   npm run dev
   ```

6. **Verify functionality**:
   - Create a new document type
   - Upload a document
   - Process the document
   - Check that files are created in the `data/` directory

## Benefits

- **No database required**: Eliminates the need for PostgreSQL/Neon database
- **Portable**: Easy to backup, move, and version control
- **Transparent**: Files are human-readable JSON and can be inspected directly
- **Scalable**: Can handle large numbers of documents efficiently
- **Simple deployment**: No database setup required

## File Management

### Backup
Simply copy the entire `data/` directory:
```bash
cp -r data/ backup-$(date +%Y%m%d)/
```

### Version Control
You can add the `data/` directory to `.gitignore` for production or include sample data for development:
```gitignore
# Ignore production data
data/

# But allow sample data
!data/sample/
```

### Cleanup
Remove old or test data:
```bash
rm -rf data/document-types/test-type/
```

## Troubleshooting

### Permission Issues
Ensure the application has write permissions to the data directory:
```bash
chmod -R 755 data/
```

### Missing Files
If documents appear in the UI but files are missing, check:
1. File permissions
2. Correct DATA_DIR environment variable
3. File paths in metadata.json

### Performance
For large numbers of documents, consider:
1. Regular cleanup of old/processed documents
2. Archiving completed documents to separate storage
3. Implementing file indexing if search becomes slow

## Security Considerations

- Ensure the `data/` directory is not publicly accessible via web server
- Implement proper file validation for uploads
- Consider encryption for sensitive documents
- Regular backups of the data directory
- Proper file permissions (755 for directories, 644 for files)
