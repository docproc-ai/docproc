# API Reference

## Overview

DocProc exposes a RESTful API for external integrations and automation. All endpoints support API key authentication.

## Authentication

### API Key

Include the API key in the `x-api-key` header:

```http
GET /api/documents
x-api-key: your-api-key
```

API key is configured via `API_KEY` environment variable.

### Session Cookie

Browser-based clients use session cookies set by Better-Auth.

## Base URL

```
https://your-domain.com/api
```

## Response Format

All responses are JSON with consistent structure:

**Success**:
```json
{
  "data": { ... },
  "success": true
}
```

**Error**:
```json
{
  "error": "Error message",
  "success": false
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
    "document_count": 42,
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
  "providerName": "anthropic",
  "modelName": "claude-3-5-sonnet-20241022",
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
  "createdAt": "2025-01-08T12:00:00.000Z"
}
```

### Get Document Type

```http
GET /api/document-types/:id
```

**Response**: Full document type object

### Update Document Type

```http
PUT /api/document-types/:id
Content-Type: application/json
```

**Body**: Same as create (partial updates supported)

### Delete Document Type

```http
DELETE /api/document-types/:id
```

**Response**:
```json
{
  "success": true,
  "message": "Document type deleted successfully"
}
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
- `model=model-name`: Override model (admin only)

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
    },
    {
      "filename": "invalid.txt",
      "success": false,
      "error": "Unsupported file type"
    }
  ],
  "jobIds": ["process-doc-xxx"],
  "batchId": "uuid",
  "summary": {
    "total": 2,
    "uploaded": 1,
    "failed": 1
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

**Response**: Updated document object

### Delete Document

```http
DELETE /api/documents/:id
```

**Response**:
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

### Download File

```http
GET /api/documents/:id/file
```

**Response**: Binary file with appropriate Content-Type

**Headers**:
- `Content-Type`: `application/pdf` or `image/*`
- `Content-Disposition`: `inline; filename="original.pdf"`
- `ETag`: File hash
- `Last-Modified`: Modification timestamp

---

## Processing Jobs

### Process Single Document

```http
POST /api/jobs/process-single
Content-Type: application/json
```

**Body**:
```json
{
  "documentId": "uuid",
  "documentTypeId": "uuid",
  "schema": { ... },
  "model": "claude-opus-4-20250514",
  "skipValidation": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `documentId` | string | Yes | Document to process |
| `documentTypeId` | string | Yes | Document type |
| `schema` | object | Yes | JSON Schema |
| `model` | string | No | Model override (admin) |
| `skipValidation` | boolean | No | Skip validation step |

**Response**:
```json
{
  "success": true,
  "jobId": "process-doc-xxx",
  "documentId": "uuid"
}
```

### Process Batch

```http
POST /api/jobs/batch-process
Content-Type: application/json
```

**Body**:
```json
{
  "documentIds": ["uuid1", "uuid2", "uuid3"],
  "documentTypeId": "uuid",
  "schema": { ... },
  "model": "claude-3-5-sonnet-20241022"
}
```

**Response**:
```json
{
  "success": true,
  "batchId": "uuid",
  "jobIds": ["process-doc-xxx", "process-doc-yyy"],
  "totalCount": 3
}
```

### Get Job Status

```http
GET /api/jobs/status?jobIds=job1,job2,job3
```

**Response**:
```json
[
  {
    "jobId": "process-doc-xxx",
    "documentId": "uuid",
    "status": "active",
    "progress": {
      "partialData": { ... },
      "stage": "extracting"
    },
    "progressPercent": 45
  },
  {
    "jobId": "process-doc-yyy",
    "documentId": "uuid",
    "status": "completed",
    "result": { ... }
  }
]
```

**Status Values**: `waiting`, `active`, `completed`, `failed`, `delayed`, `paused`, `not_found`

### Stream Job Events (SSE)

```http
GET /api/jobs/events?jobId=xxx
GET /api/jobs/events?batchId=yyy
```

**Event Stream**:
```
event: message
data: {"type":"connected","jobId":"xxx"}

event: message
data: {"type":"progress","documentId":"uuid","progressData":{"partialData":{}}}

event: message
data: {"type":"completed","documentId":"uuid"}
```

### Get Jobs by Documents

```http
GET /api/jobs/by-documents?documentIds=id1,id2,id3
```

**Response**:
```json
{
  "uuid1": {
    "status": "active",
    "userId": "uuid",
    "userName": "John Doe",
    "jobId": "process-doc-xxx",
    "progress": 50
  }
}
```

### Cancel Job

```http
POST /api/jobs/cancel
Content-Type: application/json
```

**Body**:
```json
{
  "jobId": "process-doc-xxx"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Job cancelled"
}
```

### Cancel Batch

```http
POST /api/jobs/cancel-batch
Content-Type: application/json
```

**Body**:
```json
{
  "batchId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "cancelled": 5,
  "alreadyCompleted": 2
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

When enabled, AI processing is rate limited:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704729600
```

**Response when limited**:
```json
{
  "error": "Rate limit exceeded. Try again later.",
  "retryAfter": 3600
}
```
