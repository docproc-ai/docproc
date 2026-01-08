# DocProc Architecture

## Overview

DocProc is a human-in-the-loop document extraction platform. This document describes the current architecture after migrating from Next.js to Bun + Hono + Vite + TanStack Router.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Backend | Hono |
| Frontend | Vite + React 19 + TanStack Router |
| Database | PostgreSQL + Drizzle ORM |
| Auth | better-auth |
| AI | OpenRouter (AI SDK) |
| UI | shadcn/ui + Tailwind CSS |
| Validation | Zod + drizzle-zod |

## Project Structure

```
/
├── package.json              # Single unified deps
├── biome.json                # Linting/formatting
├── drizzle.config.ts         # Database config
├── tsconfig.json             # Server/DB TypeScript
├── src/
│   ├── server/               # Hono backend
│   │   ├── index.ts          # Entry point, exports AppType
│   │   ├── routes/
│   │   │   ├── documents.ts
│   │   │   └── document-types.ts
│   │   └── middleware/
│   │       └── auth.ts       # (scaffold)
│   ├── frontend/             # Vite + React SPA
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── components/
│   │   ├── routes/
│   │   └── lib/
│   │       └── api.ts        # Hono RPC client
│   ├── shared/               # Shared between frontend/backend
│   │   └── schemas.ts        # Zod schemas from drizzle-zod
│   └── db/
│       ├── index.ts          # Drizzle connection
│       └── schema/
│           ├── auth.ts       # User, session, account tables
│           └── app.ts        # Document, job, batch tables
└── drizzle/                  # Migrations (preserved from legacy)
```

## Key Patterns

### 1. Hono RPC (Type-Safe API)

Server exports `AppType`, frontend imports it for fully typed API calls:

```typescript
// src/server/index.ts
const routes = app
  .route('/api/documents', documents)
  .route('/api/document-types', documentTypes)

export type AppType = typeof routes

// src/frontend/lib/api.ts
import { hc } from 'hono/client'
import type { AppType } from '../../server'

export const api = hc<AppType>('/')

// Usage - fully typed!
const res = await api.api.documents.$get()
const data = await res.json()
```

### 2. drizzle-zod (Single Source of Truth)

Drizzle tables → drizzle-zod → Zod schemas:

```typescript
// src/shared/schemas.ts
import { createSelectSchema, createInsertSchema } from 'drizzle-zod'
import { document } from '../db/schema/app'

export const documentSelectSchema = createSelectSchema(document)
export const documentInsertSchema = createInsertSchema(document)
```

### 3. Route Validation

Use shared schemas with `@hono/zod-validator`:

```typescript
// src/server/routes/documents.ts
import { zValidator } from '@hono/zod-validator'
import { createDocumentRequest } from '../../shared/schemas'

const documents = new Hono()
  .post('/',
    zValidator('json', createDocumentRequest),
    (c) => {
      const data = c.req.valid('json') // Typed!
      // ...
    }
  )
```

### 4. Development Setup

```bash
bun run dev           # Runs both frontend (3000) and backend (3001)
bun run dev:frontend  # Vite dev server with HMR
bun run dev:server    # Bun with --watch
```

Vite proxies `/api/*` and `/ws/*` to backend during development.

### 5. Production Build

```bash
bun run build         # Builds frontend to dist/frontend/
```

In production, Hono serves static files from `dist/frontend/`.

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev servers |
| `bun run build` | Build frontend |
| `bun run ui:add <component>` | Add shadcn component |
| `bun run db:push` | Push schema to database |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run check` | Run Biome linter |

## What's Implemented

- [x] Project structure
- [x] Hono server with RPC types
- [x] Vite frontend scaffold
- [x] Drizzle schema (documents, jobs, batches, auth)
- [x] drizzle-zod integration
- [x] Typed API client
- [x] shadcn/ui setup

## What Needs Implementation

### Backend
- [ ] Database queries in route handlers
- [ ] better-auth integration
- [ ] File upload/storage (local filesystem)
- [ ] OpenRouter AI processing
- [ ] WebSocket server for real-time job updates
- [ ] Webhook delivery

### Frontend
- [ ] Auth pages (login, register)
- [ ] Document type management UI
- [ ] Document upload & list
- [ ] Document viewer (PDF/images)
- [ ] Extraction result editor
- [ ] Job progress via WebSocket
- [ ] TanStack Query integration

## Environment Variables

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/docproc
OPENROUTER_API_KEY=sk-or-...
AUTH_SECRET=...
```

## Database Schema

See `src/db/schema/` for full definitions. Key tables:

- `user`, `session`, `account`, `verification` - better-auth tables
- `document_type` - extraction schemas
- `document` - uploaded documents
- `job` - processing queue
- `batch` - batch processing

Migrations are in `/drizzle/` and are preserved from the legacy Next.js app for production database compatibility.
