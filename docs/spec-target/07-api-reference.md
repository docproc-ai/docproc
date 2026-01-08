# API Reference (Target)

## Overview

DocProc exposes a RESTful API built with Hono. All endpoints support API key authentication for external integrations.

## Base URL

```
https://your-domain.com/api
```

## Authentication

### API Key

Include the API key in the `x-api-key` header:

```http
GET /api/documents
x-api-key: your-api-key
```

### Session Cookie

Browser-based clients use session cookies set by Better-Auth.

### Authentication Middleware

```typescript
// API key or session auth
app.use('/api/*', requireApiKeyOrAuth)

// Session-only routes
app.use('/api/admin/*', requireAuth)
```

## Response Format

All responses are JSON:

**Success**:
```json
{
  "id": "uuid",
  "name": "Invoice",
  ...
}
```

**Error**:
```json
{
  "error": "Error message"
}
```

---

## Document Types

### List Document Types

```http
GET /api/document-types
```

**Response**:
```json
[
  {
    "id": "uuid",
    "name": "Invoice",
    "slug": "invoice",
    "documentCount": 42,
    "createdAt": "2025-01-08T12:00:00.000Z"
  }
]
```

### Create Document Type

```http
POST /api/document-types
Content-Type: application/json
```

**Body**:
```json
{
  "name": "Invoice",
  "schema": {
    "type": "object",
    "properties": {
      "invoiceNumber": { "type": "string" },
      "total": { "type": "number" }
    },
    "required": ["invoiceNumber"]
  },
  "validationInstructions": "Validate this is an invoice...",
  "modelName": "anthropic/claude-3.5-sonnet",
  "webhookConfig": {
    "events": {
      "document.approved": {
        "enabled": true,
        "url": "https://example.com/webhook",
        "method": "POST",
        "headers": []
      }
    }
  }
}
```

**Response**:
```json
{
  "id": "uuid",
  "name": "Invoice",
  "slug": "invoice",
  "schema": { ... },
  "modelName": "anthropic/claude-3.5-sonnet",
  "createdAt": "2025-01-08T12:00:00.000Z"
}
```

### Get Document Type

```http
GET /api/document-types/:id
```

### Update Document Type

```http
PUT /api/document-types/:id
Content-Type: application/json
```

### Delete Document Type

```http
DELETE /api/document-types/:id
```

**Warning**: Deletes all associated documents and files.

### Upload Documents

```http
POST /api/document-types/:id/upload
Content-Type: multipart/form-data
```

**Form Fields**:
- `files` or `file`: File(s) to upload

**Query Parameters**:
- `autoProcess=true`: Queue processing after upload

**Response**:
```json
{
  "success": true,
  "documentTypeId": "uuid",
  "results": [
    {
      "filename": "invoice.pdf",
      "success": true,
      "documentId": "uuid"
    }
  ],
  "jobIds": ["job-xxx"],
  "batchId": "uuid",
  "summary": {
    "total": 2,
    "uploaded": 2,
    "failed": 0
  }
}
```

---

## Documents

### List Documents

```http
GET /api/documents?documentTypeId=uuid&page=1&pageSize=50&status=pending&search=invoice
```

**Query Parameters**:

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `documentTypeId` | string | Yes | - | Filter by document type |
| `page` | number | No | 1 | Page number |
| `pageSize` | number | No | 50 | Items per page (max 100) |
| `status` | string | No | all | pending, processed, approved, rejected, all |
| `search` | string | No | - | Search filename |

**Response**:
```json
{
  "documents": [
    {
      "id": "uuid",
      "documentTypeId": "uuid",
      "status": "pending",
      "filename": "invoice.pdf",
      "createdAt": "2025-01-08T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 142,
    "totalPages": 3
  }
}
```

### Get Document

```http
GET /api/documents/:id
```

**Response**:
```json
{
  "id": "uuid",
  "documentTypeId": "uuid",
  "status": "processed",
  "filename": "invoice.pdf",
  "extractedData": {
    "invoiceNumber": "INV-001",
    "total": 1500.00
  },
  "schemaSnapshot": { ... },
  "createdAt": "2025-01-08T12:00:00.000Z",
  "updatedAt": "2025-01-08T12:05:00.000Z"
}
```

### Update Document

```http
PUT /api/documents/:id
Content-Type: application/json
```

**Body**:
```json
{
  "extractedData": {
    "invoiceNumber": "INV-001-CORRECTED",
    "total": 1500.00
  },
  "status": "approved",
  "schemaSnapshot": { ... }
}
```

### Delete Document

```http
DELETE /api/documents/:id
```

### Download File

```http
GET /api/documents/:id/file
```

**Response**: Binary file or redirect to presigned URL

### Bulk Status Update

```http
POST /api/documents/bulk-status
Content-Type: application/json
```

**Body**:
```json
{
  "documentIds": ["uuid1", "uuid2"],
  "status": "approved"
}
```

### Bulk Delete

```http
POST /api/documents/bulk-delete
Content-Type: application/json
```

**Body**:
```json
{
  "documentIds": ["uuid1", "uuid2"]
}
```

### Rotate Document

```http
POST /api/documents/:id/rotate
Content-Type: application/json
```

**Body**:
```json
{
  "degrees": 90
}
```

---

## Processing Jobs

### Process Single Document

```http
POST /api/documents/:id/process
```

**Response**:
```json
{
  "jobId": "job-xxx",
  "documentId": "uuid"
}
```

### Process Batch

```http
POST /api/batches
Content-Type: application/json
```

**Body**:
```json
{
  "documentIds": ["uuid1", "uuid2", "uuid3"],
  "webhookUrl": "https://example.com/batch-complete"
}
```

**Response**:
```json
{
  "batchId": "uuid",
  "jobCount": 3
}
```

### Get Batch Status

```http
GET /api/batches/:id
```

**Response**:
```json
{
  "id": "uuid",
  "status": "processing",
  "total": 10,
  "completed": 5,
  "failed": 1,
  "createdAt": "2025-01-08T12:00:00.000Z"
}
```

### Get Job Status

```http
GET /api/jobs/:id
```

**Response**:
```json
{
  "id": "job-xxx",
  "documentId": "uuid",
  "status": "processing",
  "progress": 45,
  "partialData": { ... }
}
```

### Cancel Job

```http
POST /api/jobs/:id/cancel
```

**Response**:
```json
{
  "success": true
}
```

---

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('wss://your-domain.com/ws')
```

### Subscribe to Document Updates

```json
{ "type": "subscribe", "channel": "document-id" }
```

### Subscribe to Batch Updates

```json
{ "type": "subscribe", "channel": "batch:batch-id" }
```

### Unsubscribe

```json
{ "type": "unsubscribe", "channel": "document-id" }
```

### Cancel Job

```json
{ "type": "cancel", "jobId": "job-xxx" }
```

### Events Received

**Progress**:
```json
{
  "type": "progress",
  "jobId": "job-xxx",
  "progress": 45,
  "partialData": { ... }
}
```

**Completed**:
```json
{
  "type": "completed",
  "jobId": "job-xxx",
  "data": { ... }
}
```

**Failed**:
```json
{
  "type": "failed",
  "jobId": "job-xxx",
  "error": "Error message"
}
```

**Batch Progress**:
```json
{
  "type": "batch-progress",
  "completed": 5,
  "failed": 1,
  "total": 10,
  "status": "processing"
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource state conflict |
| 413 | Payload Too Large - File too big |
| 415 | Unsupported Media Type - Invalid file type |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |

---

## Rate Limiting

Processing requests can be rate limited:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704729600
```

**Response when limited**:
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 3600
}
```

---

## OpenAPI Schema

The API exports an OpenAPI 3.0 specification:

```http
GET /api/openapi.json
```

This can be used with:
- Swagger UI for interactive documentation
- Code generation tools
- API testing tools

### Example Hono OpenAPI Setup

```typescript
// src/server/routes/openapi.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'

const app = new OpenAPIHono()

// OpenAPI spec
app.doc('/api/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'DocProc API',
    version: '2.0.0',
  },
})

// Swagger UI
app.get('/api/docs', swaggerUI({ url: '/api/openapi.json' }))
```
