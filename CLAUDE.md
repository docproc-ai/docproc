# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DocProc is a human-in-the-loop document extraction platform that uses AI vision models to extract structured data from any document type. Users define JSON schemas for what to extract, upload documents, and the AI extracts data which humans can review and approve.

## Development Commands

```bash
# Development (runs backend + frontend concurrently)
bun run dev              # Start both backend (3001) and frontend (3000) with HMR

# Individual services
bun run dev:backend      # Backend only with watch mode
bun run dev:frontend     # Frontend only (Vite)

# Code quality
bun run check            # Run biome lint + format check
bun run lint             # Lint only
bun run format           # Format only

# Database
bun run db:push          # Push schema changes to database
bun run db:studio        # Open Drizzle Studio
bun run db:generate      # Generate migrations

# Testing
bun run test             # Run vitest

# Production
bun run build            # Build frontend for production
bun run preview          # Preview production build
```

## Architecture

### Monorepo Structure

```
packages/
  backend/     # Bun + Hono API server
  frontend/    # React + Vite SPA
```

### Backend (`packages/backend`)

- **Runtime**: Bun with Hono framework
- **API**: OpenAPI-documented REST endpoints with Zod validation
- **Database**: PostgreSQL with Drizzle ORM (schema in `src/db/schema/`)
- **Auth**: Better-auth with email/password and optional OAuth
- **WebSocket**: Real-time updates for document processing status
- **AI**: OpenRouter SDK for multi-provider AI model access

Key files:
- `src/index.ts` - Server entry, route registration, WebSocket setup
- `src/routes/` - API route handlers (documents, document-types, processing, users)
- `src/lib/processing/` - AI document extraction logic
- `src/db/schema/` - Drizzle schema definitions

### Frontend (`packages/frontend`)

- **Framework**: React 19 with TanStack Router (file-based routing)
- **State**: TanStack Query for server state
- **API Client**: Hono RPC client with full type inference from backend
- **UI**: Radix primitives via shadcn/ui, Tailwind CSS v4, Monaco Editor
- **Build**: Vite with React Compiler

Key patterns:
- `src/lib/api.ts` - Typed API client using `hc<AppType>('/')`
- `src/lib/queries.ts` - TanStack Query hooks for data fetching
- `src/pages/` - File-based routing (TanStack Router)
- `src/components/ui/` - shadcn/ui components

### Type Sharing

The frontend imports types directly from backend:
```typescript
import type { AppType } from '@docproc/backend'
```

This enables end-to-end type safety with Hono's RPC client.

## Data Model

**Document Types**: Define extraction schemas and model preferences
- `schema`: JSON Schema defining fields to extract
- `slugPattern`: Template for generating document slugs (e.g., `{vendor}-{invoice_number}`)

**Documents**: Individual files being processed
- Status workflow: `pending` → `processed` → `approved` | `rejected`
- `extractedData`: AI-extracted data matching the document type schema
- `schemaSnapshot`: Copy of schema at processing time

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_SECRET` - Auth session encryption
- `OPENROUTER_API_KEY` - AI model access

Optional:
- `AUTH_ADMIN_EMAIL`/`AUTH_ADMIN_PASSWORD` - Creates default admin on startup
- OAuth provider credentials for GitHub, Google, Microsoft

## Development Notes

- Backend runs on port 3001, frontend dev server on 3000 (proxies API requests)
- In production, backend serves the built frontend from `dist/frontend`
- WebSocket endpoint at `/ws` for real-time processing updates
- API docs available at `/api/docs` (Swagger UI)
