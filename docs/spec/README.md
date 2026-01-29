# DocProc Specification

This directory contains the comprehensive technical specification for DocProc, a human-in-the-loop document extraction platform.

## Table of Contents

| Document | Description |
|----------|-------------|
| [Overview](./01-overview.md) | System overview, architecture, and core concepts |
| [Authentication](./02-authentication.md) | Auth providers, roles, permissions, API keys |
| [Document Types](./03-document-types.md) | Schema definition, configuration, webhooks |
| [Documents](./04-documents.md) | Upload, storage, lifecycle, status workflow |
| [Processing](./05-processing.md) | AI extraction, batch processing, job queue |
| [Forms & Schema](./06-forms-schema.md) | Form renderer, schema builder, field types |
| [API Reference](./07-api-reference.md) | Complete REST API documentation |
| [Webhooks](./08-webhooks.md) | Event types, payloads, configuration |
| [Storage](./09-storage.md) | File storage, future object storage plans |
| [UI & Components](./10-ui-components.md) | Document viewer, keyboard shortcuts, themes |

## Version

- **Current Version**: 1.0.0
- **Last Updated**: 2025-01-08
- **Status**: Production

## Quick Reference

### Core Entities

```
DocumentType (Schema Definition)
    │
    ├── schema (JSON Schema)
    ├── webhookConfig (Event handlers)
    ├── validationInstructions (AI validation)
    └── providerName/modelName (AI config)
         │
         └──► Document (Uploaded File)
                  │
                  ├── status: pending → processed → approved/rejected
                  ├── storagePath (File location)
                  ├── extractedData (AI output)
                  └── schemaSnapshot (Schema at processing time)
```

### Status Workflow

```
┌─────────┐     ┌───────────┐     ┌──────────┐
│ pending │────►│ processed │────►│ approved │
└─────────┘     └───────────┘     └──────────┘
     │               │                  │
     │               │                  │
     ▼               ▼                  ▼
┌─────────────────────────────────────────────┐
│                  rejected                    │
└─────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js / Next.js 15 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Better-Auth |
| AI | Anthropic Claude / OpenRouter |
| Queue | BullMQ + Redis |
| UI | React + shadcn/ui + Tailwind |
| File Storage | Local filesystem (see [Storage](./09-storage.md)) |
