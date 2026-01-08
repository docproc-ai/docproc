# DocProc Target Specification

This directory contains the target architecture specification for DocProc v2.0, a migration from Next.js to **Bun + Hono + Vite + TanStack Router**.

## Key Changes from Current State

| Aspect | Current | Target |
|--------|---------|--------|
| **Runtime** | Node.js / Next.js 15 | Bun |
| **Backend** | Next.js API Routes + Server Actions | Hono |
| **Frontend** | Next.js App Router | Vite + TanStack Router |
| **State Management** | useState + useEffect | TanStack Query |
| **AI Provider** | Anthropic + OpenRouter | OpenRouter only |
| **Job Queue** | BullMQ + Redis | In-process + PostgreSQL |
| **Real-time** | SSE polling | WebSocket |
| **Storage** | Local filesystem | S3-compatible or DB blobs |

## Table of Contents

| Document | Description |
|----------|-------------|
| [Overview](./01-overview.md) | New architecture, stack decisions |
| [Authentication](./02-authentication.md) | Auth with Hono adapter |
| [Document Types](./03-document-types.md) | Schema definition (unchanged) |
| [Documents](./04-documents.md) | Upload, storage, lifecycle |
| [Processing](./05-processing.md) | Simple queue, WebSocket streaming |
| [Forms & Schema](./06-forms-schema.md) | Form renderer (unchanged) |
| [API Reference](./07-api-reference.md) | Hono REST API |
| [Webhooks](./08-webhooks.md) | Event system (unchanged) |
| [Storage](./09-storage.md) | S3-compatible + DB blob options |
| [UI & Components](./10-ui-components.md) | TanStack Router integration |

## Version

- **Target Version**: 2.0.0
- **Status**: Planning

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Frontend (Vite SPA)                              │
│                                                                     │
│  TanStack Router + TanStack Query + React + shadcn/ui               │
│                                                                     │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ HTTP / WebSocket
┌─────────────────────────────▼───────────────────────────────────────┐
│                    Backend (Bun + Hono)                             │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │  REST API   │  │  WebSocket  │  │  Static     │                  │
│  │  Routes     │  │  Server     │  │  Files      │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
│                                                                     │
│  ┌─────────────────────────────────────────────────┐                │
│  │         Processing Engine (In-Process)          │                │
│  │  p-limit concurrency + PostgreSQL persistence   │                │
│  └─────────────────────────────────────────────────┘                │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│                    Data Layer                                       │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ PostgreSQL  │  │   Drizzle   │  │ S3/DB Blob  │                  │
│  │ (all data)  │  │    ORM      │  │  Storage    │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
│                                                                     │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│                    External Services                                │
│                                                                     │
│  ┌─────────────────────────────────────────────────┐                │
│  │                  OpenRouter                      │                │
│  │  (unified access to Claude, GPT, Gemini, etc.)  │                │
│  └─────────────────────────────────────────────────┘                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Why These Changes?

### Bun + Hono over Next.js

- **Simpler mental model**: Explicit client/server split
- **Faster builds**: Bun + Vite are significantly faster
- **Background tasks**: Long-running processes without serverless constraints
- **WebSocket native**: Built-in support, no workarounds

### OpenRouter Only

- **Unified API**: Access Claude, GPT-4, Gemini through one endpoint
- **Simplified code**: One provider interface, no switching logic
- **Cost flexibility**: Easy model switching without code changes
- **Fallback support**: OpenRouter handles provider outages

### No Redis/BullMQ

- **Fewer dependencies**: PostgreSQL handles job persistence
- **Simpler ops**: One database to manage
- **Sufficient scale**: In-process queue handles internal app load
- **Easy debugging**: Jobs are just database rows

### WebSocket over SSE

- **Bidirectional**: Client can send messages (cancel, subscribe)
- **Native support**: Hono + Bun have excellent WS support
- **Lower latency**: True push, no polling
- **Connection efficiency**: Single connection for all updates

## Quick Reference

### Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Backend | Hono |
| Frontend Build | Vite |
| Routing | TanStack Router |
| Server State | TanStack Query |
| Database | PostgreSQL + Drizzle |
| AI | OpenRouter |
| Real-time | WebSocket |
| Storage | S3-compatible or DB blobs |
| UI | React + shadcn/ui + Tailwind |

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Auth
BETTER_AUTH_URL=https://your-domain.com
AUTH_ADMIN_EMAILS=admin@example.com

# AI (OpenRouter only)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_DEFAULT_MODEL=anthropic/claude-3.5-sonnet

# Storage (choose one)
STORAGE_TYPE=s3|database|local
S3_BUCKET=docproc-documents
S3_ENDPOINT=https://...

# API
API_KEY=your-api-key
WEBHOOK_ENCRYPTION_KEY=...
```
