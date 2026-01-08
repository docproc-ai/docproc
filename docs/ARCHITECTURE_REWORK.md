# DocProc Architecture Rework

## Overview

This document outlines the migration from Next.js to a **Bun + Hono + Vite + TanStack Router** stack. The goal is a simpler, faster, and more maintainable architecture that better fits DocProc's needs as an interactive document processing application.

## Motivation

| Pain Point | Current (Next.js) | Target (Bun + Hono + Vite) |
|------------|-------------------|----------------------------|
| Background tasks | Awkward in serverless model | Native long-running processes |
| Build times | 30s+ full builds | Sub-second HMR, fast production builds |
| Bundle size | SSR hydration overhead | Pure SPA, no hydration |
| Mental model | RSC/server actions magic | Explicit API calls |
| Real-time updates | Polling every 3s | WebSocket native support |
| Debugging | Server actions hard to trace | Standard HTTP requests |

### Key Requirements

- **No SSR needed** - DocProc is an interactive app, not content-focused
- **Background processing** - Document extraction runs async, needs progress streaming
- **Batch API** - Automation route processes documents in bulk (heaviest use case)
- **Cross-session visibility** - Multiple users see processing status
- **Simple infrastructure** - Minimize external dependencies

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (SPA)                              │
│  Vite + React + TanStack Router + TanStack Query                    │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │   Routes    │  │ Components  │  │   Queries   │                  │
│  │  (Router)   │  │ (shadcn/ui) │  │  (TanStack) │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP / WebSocket
┌────────────────────────────▼────────────────────────────────────────┐
│                         Backend (API)                               │
│  Bun + Hono                                                         │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │   Routes    │  │ Middleware  │  │  WebSocket  │                  │
│  │  /api/*     │  │ (auth,cors) │  │   Server    │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
│                                                                     │
│  ┌─────────────────────────────────────────────────┐                │
│  │            Processing Engine                     │                │
│  │  - Concurrency control (p-limit)                │                │
│  │  - Batch processing                             │                │
│  │  - Progress broadcasting                        │                │
│  └─────────────────────────────────────────────────┘                │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                         Data Layer                                  │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │  PostgreSQL │  │   Drizzle   │  │    Files    │                  │
│  │  (primary)  │  │    ORM      │  │  (storage)  │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
docproc/
├── src/
│   ├── client/                    # Frontend SPA
│   │   ├── routes/                # TanStack Router routes
│   │   │   ├── __root.tsx         # Root layout
│   │   │   ├── index.tsx          # Home/dashboard
│   │   │   ├── document-types/
│   │   │   │   ├── index.tsx      # List document types
│   │   │   │   └── $id.tsx        # Document processor view
│   │   │   └── settings.tsx
│   │   ├── components/            # React components (migrate existing)
│   │   │   ├── ui/                # shadcn/ui (unchanged)
│   │   │   ├── document-processor.tsx
│   │   │   ├── document-queue.tsx
│   │   │   ├── document-viewer.tsx
│   │   │   ├── form-renderer/
│   │   │   └── schema-builder/
│   │   ├── lib/                   # Client utilities
│   │   │   ├── api.ts             # API client (typed fetch wrapper)
│   │   │   ├── auth.ts            # Auth client
│   │   │   └── ws.ts              # WebSocket client
│   │   ├── queries/               # TanStack Query definitions
│   │   │   ├── documents.ts
│   │   │   ├── document-types.ts
│   │   │   └── batches.ts
│   │   ├── main.tsx               # Entry point
│   │   └── router.tsx             # Router configuration
│   │
│   ├── server/                    # Backend API
│   │   ├── routes/                # Hono route handlers
│   │   │   ├── auth.ts            # Authentication endpoints
│   │   │   ├── documents.ts       # Document CRUD
│   │   │   ├── document-types.ts  # Document type CRUD
│   │   │   ├── batches.ts         # Batch processing
│   │   │   └── files.ts           # File upload/download
│   │   ├── middleware/
│   │   │   ├── auth.ts            # Session validation
│   │   │   ├── cors.ts            # CORS configuration
│   │   │   └── error.ts           # Error handling
│   │   ├── processing/            # Document processing engine
│   │   │   ├── engine.ts          # Core processing logic
│   │   │   ├── batch.ts           # Batch management
│   │   │   └── ai.ts              # AI extraction (Anthropic)
│   │   ├── ws/                    # WebSocket handling
│   │   │   ├── server.ts          # WS server setup
│   │   │   └── handlers.ts        # Message handlers
│   │   ├── lib/                   # Server utilities
│   │   │   ├── storage.ts         # File storage
│   │   │   └── providers.ts       # AI provider config
│   │   └── index.ts               # Server entry point
│   │
│   ├── db/                        # Database (unchanged)
│   │   ├── schema/
│   │   │   ├── app.ts             # Application tables
│   │   │   ├── auth.ts            # Auth tables
│   │   │   └── jobs.ts            # NEW: Job/batch tracking
│   │   ├── index.ts
│   │   └── migrate.ts
│   │
│   └── shared/                    # Shared between client/server
│       ├── types/                 # TypeScript types
│       │   ├── documents.ts
│       │   ├── batches.ts
│       │   └── api.ts             # API request/response types
│       └── validation/            # Zod schemas
│           ├── documents.ts
│           └── batches.ts
│
├── public/                        # Static assets
├── drizzle/                       # Migrations (unchanged)
├── data/                          # File storage (unchanged)
│
├── package.json
├── tsconfig.json
├── vite.config.ts                 # Vite configuration
├── bunfig.toml                    # Bun configuration
└── .env
```

---

## Tech Stack Details

### Runtime & Build

| Tool | Purpose | Why |
|------|---------|-----|
| **Bun** | Runtime, package manager, bundler | Fast, all-in-one, native TypeScript |
| **Vite** | Frontend dev server & build | Best-in-class HMR, fast builds |

### Frontend

| Library | Purpose | Why |
|---------|---------|-----|
| **React 19** | UI framework | Already using, stable ecosystem |
| **TanStack Router** | Client routing | Type-safe, built-in data loading |
| **TanStack Query** | Server state | Caching, background refetch, mutations |
| **shadcn/ui** | Components | Already using, no changes needed |
| **Tailwind CSS** | Styling | Already using, no changes needed |

### Backend

| Library | Purpose | Why |
|---------|---------|-----|
| **Hono** | HTTP framework | Fast, type-safe, middleware ecosystem |
| **Drizzle ORM** | Database | Already using, excellent DX |
| **better-auth** | Authentication | Has Hono adapter, already using |
| **Zod** | Validation | Already using, shared with frontend |

### Processing

| Library | Purpose | Why |
|---------|---------|-----|
| **p-limit** | Concurrency control | Simple, lightweight (~20 LOC) |
| **AI SDK** | LLM integration | Already using for Anthropic |

---

## API Design

### RESTful Endpoints

```typescript
// Authentication
POST   /api/auth/signin
POST   /api/auth/signout
GET    /api/auth/session

// Document Types
GET    /api/document-types
POST   /api/document-types
GET    /api/document-types/:id
PUT    /api/document-types/:id
DELETE /api/document-types/:id

// Documents
GET    /api/documents                    // List (with filters)
POST   /api/documents                    // Upload
GET    /api/documents/:id
PUT    /api/documents/:id
DELETE /api/documents/:id
GET    /api/documents/:id/file           // Download file

// Processing (Interactive)
POST   /api/documents/:id/process        // Process single document
POST   /api/documents/:id/stop           // Stop processing

// Batch Processing (API/Automation)
POST   /api/batches                      // Create batch job
GET    /api/batches                      // List batches
GET    /api/batches/:id                  // Get batch status
POST   /api/batches/:id/cancel           // Cancel batch

// WebSocket
WS     /ws                               // Real-time updates
```

### WebSocket Protocol

```typescript
// Client -> Server
interface WSClientMessage {
  type: 'subscribe' | 'unsubscribe'
  channel: 'document' | 'batch'
  id: string
}

// Server -> Client
interface WSServerMessage {
  type: 'progress' | 'completed' | 'failed'
  channel: 'document' | 'batch'
  id: string
  data: {
    progress?: number
    partialData?: any
    error?: string
  }
}
```

---

## Processing Engine

### Architecture

No external job queue (Redis/BullMQ). Simple in-process management with database persistence.

```typescript
// src/server/processing/engine.ts

import pLimit from 'p-limit'

// Concurrency limit for AI API calls
const processLimit = pLimit(5)

// In-memory state for active jobs (fast access)
const activeJobs = new Map<string, JobState>()
const activeBatches = new Map<string, BatchState>()

interface JobState {
  documentId: string
  status: 'processing' | 'completed' | 'failed'
  progress: number
  startedAt: Date
}

interface BatchState {
  id: string
  total: number
  completed: number
  failed: number
  status: 'processing' | 'completed' | 'failed' | 'cancelled'
  documents: Map<string, 'pending' | 'processing' | 'completed' | 'failed'>
}
```

### Single Document Processing

```typescript
export async function processDocument(
  documentId: string,
  schema: JsonSchema,
  options?: { onProgress?: (data: any) => void }
): Promise<void> {
  const jobId = `doc-${documentId}`

  // Track in memory
  activeJobs.set(jobId, {
    documentId,
    status: 'processing',
    progress: 0,
    startedAt: new Date(),
  })

  try {
    // Stream AI extraction
    for await (const chunk of streamExtraction(documentId, schema)) {
      const job = activeJobs.get(jobId)!
      job.progress = chunk.progress

      // Broadcast via WebSocket
      broadcast('document', documentId, {
        type: 'progress',
        progress: chunk.progress,
        partialData: chunk.data,
      })

      options?.onProgress?.(chunk)
    }

    // Mark completed
    activeJobs.get(jobId)!.status = 'completed'
    broadcast('document', documentId, { type: 'completed' })

  } catch (error) {
    activeJobs.get(jobId)!.status = 'failed'
    broadcast('document', documentId, { type: 'failed', error: error.message })
    throw error
  } finally {
    // Cleanup after a delay (allow clients to receive final message)
    setTimeout(() => activeJobs.delete(jobId), 5000)
  }
}
```

### Batch Processing

```typescript
export async function processBatch(
  batchId: string,
  documentIds: string[],
  schema: JsonSchema,
  options?: { webhookUrl?: string }
): Promise<void> {
  // Initialize batch state
  const state: BatchState = {
    id: batchId,
    total: documentIds.length,
    completed: 0,
    failed: 0,
    status: 'processing',
    documents: new Map(documentIds.map(id => [id, 'pending'])),
  }
  activeBatches.set(batchId, state)

  // Persist to DB for recovery
  await db.insert(batches).values({
    id: batchId,
    documentIds,
    status: 'processing',
    createdAt: new Date(),
  })

  // Process with concurrency limit
  const promises = documentIds.map(docId =>
    processLimit(async () => {
      // Check if batch was cancelled
      if (state.status === 'cancelled') return

      state.documents.set(docId, 'processing')

      try {
        await processDocument(docId, schema)
        state.documents.set(docId, 'completed')
        state.completed++
      } catch (error) {
        state.documents.set(docId, 'failed')
        state.failed++
        console.error(`Failed to process ${docId}:`, error)
      }

      // Broadcast batch progress
      broadcast('batch', batchId, {
        type: 'progress',
        completed: state.completed,
        failed: state.failed,
        total: state.total,
      })
    })
  )

  await Promise.all(promises)

  // Finalize
  state.status = state.failed === state.total ? 'failed' : 'completed'

  await db.update(batches)
    .set({ status: state.status, completedAt: new Date() })
    .where(eq(batches.id, batchId))

  broadcast('batch', batchId, { type: state.status })

  // Webhook callback
  if (options?.webhookUrl) {
    await fetch(options.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId,
        status: state.status,
        total: state.total,
        completed: state.completed,
        failed: state.failed,
      }),
    }).catch(console.error)
  }

  // Cleanup
  activeBatches.delete(batchId)
}

export function cancelBatch(batchId: string): boolean {
  const batch = activeBatches.get(batchId)
  if (!batch || batch.status !== 'processing') return false

  batch.status = 'cancelled'
  broadcast('batch', batchId, { type: 'cancelled' })
  return true
}
```

### Startup Recovery

```typescript
// src/server/processing/recovery.ts

export async function recoverPendingJobs(): Promise<void> {
  const pendingBatches = await db.query.batches.findMany({
    where: eq(batches.status, 'processing'),
  })

  for (const batch of pendingBatches) {
    console.log(`Recovering batch ${batch.id}...`)

    // Find documents that weren't processed
    const unprocessed = await db.query.documents.findMany({
      where: and(
        inArray(documents.id, batch.documentIds),
        notInArray(documents.status, ['processed', 'approved'])
      ),
    })

    if (unprocessed.length > 0) {
      // Resume batch with remaining documents
      processBatch(
        batch.id,
        unprocessed.map(d => d.id),
        batch.schema
      )
    } else {
      // All documents processed, mark complete
      await db.update(batches)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(batches.id, batch.id))
    }
  }
}
```

---

## Database Schema Changes

### New Tables

```typescript
// src/db/schema/jobs.ts

import { pgTable, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core'

export const batches = pgTable('batches', {
  id: text('id').primaryKey(),
  documentTypeId: text('document_type_id').references(() => documentTypes.id),
  documentIds: text('document_ids').array().notNull(),
  schema: jsonb('schema').notNull(),
  status: text('status', {
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled']
  }).default('pending'),
  total: integer('total').notNull(),
  completed: integer('completed').default(0),
  failed: integer('failed').default(0),
  webhookUrl: text('webhook_url'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  createdBy: text('created_by').references(() => users.id),
})
```

---

## Frontend Migration

### TanStack Router Setup

```typescript
// src/client/router.tsx

import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'

const queryClient = new QueryClient()

const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

const documentTypesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/document-types',
  component: DocumentTypesList,
  loader: () => queryClient.ensureQueryData(documentTypesQuery()),
})

const documentTypeRoute = createRoute({
  getParentRoute: () => documentTypesRoute,
  path: '$id',
  component: DocumentProcessor,
  loader: ({ params }) => queryClient.ensureQueryData(documentTypeQuery(params.id)),
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  documentTypesRoute.addChildren([documentTypeRoute]),
])

export const router = createRouter({ routeTree })
```

### TanStack Query Integration

```typescript
// src/client/queries/documents.ts

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export const documentsQuery = (documentTypeId: string, filters?: DocumentFilters) =>
  queryOptions({
    queryKey: ['documents', documentTypeId, filters],
    queryFn: () => api.get(`/documents`, {
      params: { documentTypeId, ...filters }
    }),
  })

export const useUpdateDocument = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDocumentInput }) =>
      api.put(`/documents/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}

export const useProcessDocument = () => {
  return useMutation({
    mutationFn: (id: string) => api.post(`/documents/${id}/process`),
    // Progress updates come via WebSocket, not mutation
  })
}
```

### WebSocket Hook

```typescript
// src/client/lib/ws.ts

import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export function useDocumentProgress(documentId: string | null) {
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!documentId) return

    const ws = new WebSocket(`${WS_URL}/ws`)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'document', id: documentId }))
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)

      if (message.type === 'progress') {
        // Update query cache with partial data
        queryClient.setQueryData(['document', documentId], (old: any) => ({
          ...old,
          extractedData: message.data.partialData,
        }))
      }

      if (message.type === 'completed') {
        // Refetch to get final data
        queryClient.invalidateQueries({ queryKey: ['document', documentId] })
      }
    }

    return () => {
      ws.close()
    }
  }, [documentId, queryClient])

  return wsRef.current
}
```

---

## Migration Steps

### Phase 1: Setup & Infrastructure

1. [ ] Initialize Bun project alongside Next.js
2. [ ] Set up Vite configuration
3. [ ] Set up Hono server with basic routes
4. [ ] Configure TanStack Router
5. [ ] Configure TanStack Query
6. [ ] Set up WebSocket server

### Phase 2: Backend Migration

1. [ ] Migrate auth routes to Hono (better-auth adapter)
2. [ ] Migrate document-types routes
3. [ ] Migrate documents routes
4. [ ] Migrate file upload/download
5. [ ] Implement new batch processing system
6. [ ] Add WebSocket handlers
7. [ ] Add startup recovery

### Phase 3: Frontend Migration

1. [ ] Set up TanStack Router routes
2. [ ] Migrate DocumentProcessor component
3. [ ] Migrate DocumentQueue component
4. [ ] Migrate FormRenderer components
5. [ ] Migrate SchemaBuilder components
6. [ ] Add WebSocket integration
7. [ ] Replace server actions with TanStack Query mutations

### Phase 4: Testing & Cleanup

1. [ ] Test all API endpoints
2. [ ] Test WebSocket functionality
3. [ ] Test batch processing
4. [ ] Test restart recovery
5. [ ] Performance testing
6. [ ] Remove Next.js code
7. [ ] Update deployment configuration

---

## Configuration Files

### vite.config.ts

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    TanStackRouterVite(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/client'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist/client',
  },
})
```

### bunfig.toml

```toml
[install]
peer = false

[run]
bun = true
```

### package.json (scripts)

```json
{
  "scripts": {
    "dev": "concurrently \"bun run dev:server\" \"bun run dev:client\"",
    "dev:client": "vite",
    "dev:server": "bun --watch src/server/index.ts",
    "build": "bun run build:client && bun run build:server",
    "build:client": "vite build",
    "build:server": "bun build src/server/index.ts --outdir dist/server --target bun",
    "start": "bun dist/server/index.js",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

---

## Deployment

### Single Process (Recommended for Internal App)

```typescript
// src/server/index.ts

import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { cors } from 'hono/cors'

const app = new Hono()

// API routes
app.route('/api/auth', authRoutes)
app.route('/api/documents', documentRoutes)
app.route('/api/document-types', documentTypeRoutes)
app.route('/api/batches', batchRoutes)

// WebSocket upgrade
app.get('/ws', upgradeWebSocket(wsHandler))

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist/client' }))
  app.get('*', serveStatic({ path: './dist/client/index.html' }))
}

// Startup
await recoverPendingJobs()

export default {
  port: process.env.PORT || 3001,
  fetch: app.fetch,
  websocket: wsHandler,
}
```

### Docker

```dockerfile
FROM oven/bun:1 AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3001
CMD ["bun", "run", "start"]
```

---

## Open Questions

1. **Auth approach**: Stick with better-auth or switch to Lucia for simpler Hono integration?
2. **File storage**: Keep local filesystem or migrate to S3-compatible storage?
3. **Monitoring**: Add OpenTelemetry or keep it simple with console logging?
4. **Rate limiting**: Implement per-user rate limits on API?

---

## References

- [Hono Documentation](https://hono.dev/)
- [TanStack Router](https://tanstack.com/router)
- [TanStack Query](https://tanstack.com/query)
- [Vite](https://vitejs.dev/)
- [Bun](https://bun.sh/)
- [better-auth Hono Adapter](https://www.better-auth.com/docs/integrations/hono)
