# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DocProc is a human-in-the-loop document extraction platform that uses AI vision models to extract structured data from any document type. The system processes PDFs and images using Anthropic's Claude models, with manual verification and approval workflows.

## Common Development Commands

### Development Server
```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Build for production
npm run start        # Start production server
```

### Code Quality
```bash
npm run lint         # Run Next.js linter
npm run format       # Format code with Prettier
```

### Database Management
```bash
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Drizzle Studio for database management
```

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: Anthropic Claude models via AI SDK
- **Auth**: Better-auth with social providers (GitHub, Google, Microsoft)
- **UI**: Shadcn/ui components with Tailwind CSS
- **File Storage**: Local filesystem storage

### Core Data Models

**Document Types** (`src/db/schema/app.ts:4-17`):
- Define extraction schemas and validation rules
- Support custom JSON schemas for different document formats
- Include webhook configuration for integrations

**Documents** (`src/db/schema/app.ts:25-48`):
- Status workflow: `pending` → `processed` → `approved`
- Store extracted data and schema snapshots
- Link to document types and user accounts

**Users** (`src/db/schema/auth.ts`):
- Role-based permissions (admin/user)
- Social authentication support

### Key Application Flow

1. **Document Type Creation**: Admin creates document types with JSON schemas
2. **Document Upload**: Users upload files and associate with document types
3. **AI Processing**: Claude vision models extract data based on schemas
4. **Human Review**: Users review and edit AI-extracted data in form interface
5. **Approval**: Finalized data triggers webhooks and becomes available via API

### Authentication & Permissions
- Better-auth handles session management and social providers
- Middleware enforces authentication on all routes except `/api/auth`
- Admin users can override AI models and manage document types
- Role-based access control using permission system

### AI Document Processing
- **Entry Point**: `src/lib/actions/process.ts:170` - Main processing function
- **Model Selection**: Supports model override (admin-only) or document type defaults
- **Vision Support**: Handles both PDF files and images through Claude vision models
- **Schema Validation**: Uses AI SDK's jsonSchema helper for structured extraction
- **Streaming**: Supports real-time partial results during processing

### API Routes Structure
```
/api/
  auth/[...all]/        # Better-auth endpoints
  document-types/       # CRUD operations for document schemas
    [id]/upload/        # File upload endpoint
  documents/            # Document management
    [id]/file/          # File download endpoint
  process-document/     # AI processing endpoint
```

### Component Architecture
- **Document Processor** (`src/components/document-processor.tsx`): Main processing interface
- **Schema Builder** (`src/components/schema-builder/`): Visual JSON schema creation
- **Form Renderer** (`src/components/form-renderer/`): Dynamic form generation from schemas
- **Document Viewer**: PDF/image viewing with react-pdf and zoom controls

### Environment Configuration
- Requires `DATABASE_URL` for PostgreSQL connection
- `AUTH_ADMIN_EMAILS` for initial admin user setup
- `API_KEY` for API authentication
- Social auth provider keys for GitHub, Google, Microsoft

## Development Notes

### Database Schema Management
- Use Drizzle migrations in `/drizzle` folder
- Schema files organized in `/src/db/schema/`
- Always run `npm run db:push` after schema changes

### File Storage
- Documents stored in `/data/documents/` directory
- Configured via `src/lib/storage.ts`
- Production deployments should use external storage solutions

### AI Model Configuration
- Default model: `claude-3-5-sonnet-20241022`
- Model selection hierarchy: user override → document type → system default
- Admin users can override models per processing request

### UI Components
- Built with Radix UI primitives via Shadcn/ui
- Tailwind CSS for styling with dark/light theme support
- Monaco Editor for JSON schema editing
- Custom form renderer supports nested objects and arrays