# Overview

## What is DocProc?

DocProc is a **human-in-the-loop document extraction platform** that uses AI vision models to extract structured data from documents. It combines automated AI processing with manual verification workflows to ensure data accuracy.

## Core Concepts

### Document Types

A **Document Type** defines the schema for extracting data from a category of documents. Examples:
- Invoices
- Receipts
- Medical records
- Tax forms

Each Document Type includes:
- **JSON Schema**: Defines the structure of extracted data
- **Validation Instructions**: Rules for AI to validate document type
- **AI Configuration**: Provider and model settings
- **Webhooks**: Event handlers for automation

### Documents

A **Document** is an uploaded file (PDF or image) associated with a Document Type. Documents flow through a status workflow:

```
pending → processed → approved
                   ↘ rejected
```

### Extraction Flow

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API
    participant Queue
    participant Worker
    participant AI
    participant DB

    User->>UI: Upload document
    UI->>API: POST /api/documents
    API->>DB: Create document (status: pending)
    API-->>UI: Document created

    User->>UI: Click "Process"
    UI->>API: POST /api/jobs/process-single
    API->>Queue: Add job to queue
    Queue-->>API: Job ID
    API-->>UI: Job queued

    Worker->>Queue: Poll for jobs
    Queue-->>Worker: Job payload
    Worker->>DB: Load document & schema
    Worker->>AI: Extract structured data
    AI-->>Worker: Streaming response
    Worker->>DB: Save extractedData
    Worker->>DB: Update status: processed
    Worker-->>UI: SSE progress updates

    User->>UI: Review extracted data
    User->>UI: Click "Approve"
    UI->>API: PUT /api/documents/:id
    API->>DB: Update status: approved
    API->>Webhook: Trigger document.approved
```

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Client Layer                              │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   Browser    │  │  API Client  │  │   Webhook    │               │
│  │     (UI)     │  │  (External)  │  │   Consumer   │               │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘               │
│         │                 │                                         │
└─────────┼─────────────────┼─────────────────────────────────────────┘
          │                 │
          ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API Layer (Next.js)                         │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  Auth API    │  │ Document API │  │   Jobs API   │               │
│  │ /api/auth/*  │  │/api/documents│  │  /api/jobs/* │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  Server      │  │ Middleware   │  │    SSE       │               │
│  │  Actions     │  │ (Auth/CORS)  │  │  Streaming   │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Processing Layer                              │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │                    BullMQ Job Queue                       │      │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │      │
│  │  │   Waiting   │  │   Active    │  │  Completed  │        │      │
│  │  │    Jobs     │  │    Jobs     │  │    Jobs     │        │      │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │      │
│  └───────────────────────────────────────────────────────────┘      │
│                              │                                      │
│  ┌───────────────────────────▼───────────────────────────────┐      │
│  │                   Worker Processes                         │      │
│  │  ┌─────────────────────┐  ┌─────────────────────┐          │      │
│  │  │  Document Processor │  │   Batch Processor   │          │      │
│  │  └─────────────────────┘  └─────────────────────┘          │      │
│  └───────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
          │                 │
          ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Data Layer                                  │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  PostgreSQL  │  │    Redis     │  │ File Storage │               │
│  │  (Drizzle)   │  │  (BullMQ)    │  │  (Local FS)  │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       External Services                             │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  Anthropic   │  │  OpenRouter  │  │   Webhook    │               │
│  │   Claude     │  │    (LLMs)    │  │  Endpoints   │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. AI-Powered Extraction
- Vision model support (Claude, OpenRouter models)
- Structured output with JSON Schema validation
- Streaming responses for real-time progress
- Automatic JSON repair for malformed responses

### 2. Human-in-the-Loop
- Form-based data review and editing
- Approval workflow with status tracking
- Keyboard shortcuts for rapid processing
- Unsaved changes protection

### 3. Batch Processing
- Queue-based background processing
- Concurrent processing with rate limiting
- Cross-session job visibility
- SSE-based progress streaming

### 4. Flexible Schemas
- Visual schema builder
- Support for nested objects and arrays
- Table and pivoted table views for arrays
- Custom UI widgets

### 5. Integration Ready
- RESTful API with API key auth
- Webhook events for automation
- Bulk upload and processing endpoints

## Data Model

```mermaid
erDiagram
    User ||--o{ Document : creates
    User ||--o{ DocumentType : creates
    User ||--o{ Session : has
    User ||--o{ Account : has

    DocumentType ||--o{ Document : contains

    User {
        uuid id PK
        string name
        string email UK
        boolean emailVerified
        string image
        string role
        timestamp createdAt
        timestamp updatedAt
    }

    DocumentType {
        uuid id PK
        string name
        string slug UK
        json schema
        json webhookConfig
        string validationInstructions
        string providerName
        string modelName
        timestamp createdAt
        uuid createdBy FK
    }

    Document {
        uuid id PK
        uuid documentTypeId FK
        string status
        string filename
        string storagePath
        json extractedData
        json schemaSnapshot
        string rejectionReason
        timestamp createdAt
        uuid createdBy FK
    }

    Session {
        uuid id PK
        timestamp expiresAt
        string token UK
        string ipAddress
        string userAgent
        uuid userId FK
    }

    Account {
        uuid id PK
        string accountId
        string providerId
        uuid userId FK
        string accessToken
        string refreshToken
    }
```

## File Locations

| Component | Location |
|-----------|----------|
| Database Schema | `src/db/schema/` |
| API Routes | `src/app/api/` |
| Server Actions | `src/lib/actions/` |
| Processing Logic | `src/lib/document-processing/` |
| Job Queue | `src/lib/jobs/` |
| UI Components | `src/components/` |
| Auth Config | `src/lib/auth.ts` |
| Providers | `src/lib/providers/` |
