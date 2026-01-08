# UI Components (Target)

## Overview

DocProc's UI is built with React, shadcn/ui components, and Tailwind CSS. The target architecture uses TanStack Router for routing and TanStack Query for server state management.

## Changes from Current

| Aspect | Current | Target |
|--------|---------|--------|
| Routing | Next.js App Router | TanStack Router |
| Server State | Server actions + useTransition | TanStack Query |
| Real-time | SSE polling | WebSocket |
| Theme Provider | next-themes | Custom or same |

## Component Architecture

```
src/client/
├── components/
│   ├── ui/                     # shadcn/ui primitives (unchanged)
│   ├── document-processor.tsx  # Main processing interface
│   ├── document-queue.tsx      # Document list with filters
│   ├── document-viewer.tsx     # PDF/image viewer
│   ├── form-renderer/          # Dynamic form generation (unchanged)
│   ├── schema-builder/         # Visual schema editor (unchanged)
│   ├── webhook-config.tsx      # Webhook configuration (unchanged)
│   └── theme-toggle.tsx        # Dark/light mode
├── routes/                     # TanStack Router file-based routes
├── queries/                    # TanStack Query definitions
├── lib/
│   ├── api.ts                  # Typed API client
│   ├── ws.ts                   # WebSocket client
│   └── auth.ts                 # Auth client
└── main.tsx
```

## TanStack Router Integration

### Route Structure

```
src/client/routes/
├── __root.tsx              # Root layout with auth guard
├── index.tsx               # Home/dashboard
├── document-types/
│   ├── index.tsx           # Document type list
│   ├── new.tsx             # Create document type
│   └── $id.tsx             # Document processor
├── settings.tsx            # User settings
└── auth/
    ├── signin.tsx
    └── signout.tsx
```

### Root Route

```tsx
// src/client/routes/__root.tsx
import { createRootRoute, Outlet, redirect } from '@tanstack/react-router'
import { authClient } from '../lib/auth'
import { Toaster } from '../components/ui/sonner'
import { ThemeProvider } from '../components/theme-provider'

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const session = await authClient.getSession()

    if (!session && !location.pathname.startsWith('/auth')) {
      throw redirect({ to: '/auth/signin' })
    }

    return { user: session?.user }
  },
  component: RootLayout,
})

function RootLayout() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="docproc-theme">
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
      <Toaster />
    </ThemeProvider>
  )
}
```

### Document Type Route

```tsx
// src/client/routes/document-types/$id.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useDocumentType } from '../../queries/document-types'
import { DocumentProcessor } from '../../components/document-processor'

export const Route = createFileRoute('/document-types/$id')({
  component: DocumentTypePage,
})

function DocumentTypePage() {
  const { id } = Route.useParams()
  const { data: documentType, isLoading } = useDocumentType(id)

  if (isLoading) return <LoadingSpinner />
  if (!documentType) return <NotFound />

  return <DocumentProcessor documentType={documentType} />
}
```

## Document Processor

Main interface for processing and reviewing documents.

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Header: Back | Document Name | Actions | Theme                       │
├───────────────┬───────────────────────────────┬─────────────────────┤
│               │                               │                     │
│   Document    │         Form / Data           │    Document         │
│    Queue      │          Editor               │     Viewer          │
│               │                               │                     │
│  (Resizable)  │        (Resizable)            │   (Resizable)       │
│               │                               │                     │
└───────────────┴───────────────────────────────┴─────────────────────┘
```

### Implementation with TanStack Query

```tsx
// src/client/components/document-processor.tsx
import { useState } from 'react'
import { useDocuments, useDocument, useUpdateDocument } from '../queries/documents'
import { useDocumentUpdates } from '../lib/ws'
import { FormRenderer } from './form-renderer'
import { DocumentViewer } from './document-viewer'
import { DocumentQueue } from './document-queue'

export function DocumentProcessor({ documentType }) {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [filters, setFilters] = useState({ status: 'all', page: 1 })

  // Server state
  const { data: documents } = useDocuments(documentType.id, filters)
  const { data: selectedDoc } = useDocument(selectedDocId)
  const updateDocument = useUpdateDocument()

  // Local form state
  const [formData, setFormData] = useState(selectedDoc?.extractedData)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // WebSocket for real-time updates
  const { cancel } = useDocumentUpdates(selectedDocId)

  const handleSave = () => {
    updateDocument.mutate({
      id: selectedDocId,
      extractedData: formData,
    })
    setHasUnsavedChanges(false)
  }

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={20}>
        <DocumentQueue
          documents={documents?.documents}
          selectedId={selectedDocId}
          onSelect={setSelectedDocId}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel defaultSize={40}>
        <FormRenderer
          schema={documentType.schema}
          data={formData}
          onChange={(data) => {
            setFormData(data)
            setHasUnsavedChanges(true)
          }}
        />
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel defaultSize={40}>
        <DocumentViewer document={selectedDoc} />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
```

## Document Queue

List of documents with filtering, search, and bulk actions.

### Features

| Feature | Description |
|---------|-------------|
| Multi-select | Checkbox selection for bulk actions |
| Status filter | Filter by pending, processed, approved, rejected |
| Search | Filter by filename |
| Pagination | Navigate large document sets |
| Status icons | Visual indicators for document status |
| Processing indicators | Spinner for active jobs |
| Drag & drop upload | Drop files to upload |

### Implementation

```tsx
// src/client/components/document-queue.tsx
import { useProcessDocument } from '../queries/documents'
import { useJobStatuses } from '../lib/ws'

export function DocumentQueue({
  documents,
  selectedId,
  onSelect,
  filters,
  onFiltersChange,
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const processDocument = useProcessDocument()

  // Real-time job statuses via WebSocket
  const jobStatuses = useJobStatuses(documents?.map(d => d.id) || [])

  const handleBulkProcess = () => {
    for (const docId of selected) {
      processDocument.mutate({ documentId: docId })
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="p-4 border-b">
        <Select value={filters.status} onValueChange={/* ... */}>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="processed">Processed</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
        </Select>
        <Input placeholder="Search..." />
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="p-2 bg-muted">
          <Button onClick={handleBulkProcess}>
            Process {selected.size} documents
          </Button>
        </div>
      )}

      {/* Document list */}
      <ScrollArea className="flex-1">
        {documents?.map(doc => (
          <DocumentItem
            key={doc.id}
            document={doc}
            selected={selected.has(doc.id)}
            active={doc.id === selectedId}
            jobStatus={jobStatuses[doc.id]}
            onSelect={() => onSelect(doc.id)}
            onToggle={() => /* toggle selection */}
          />
        ))}
      </ScrollArea>

      {/* Pagination */}
      <Pagination
        page={filters.page}
        totalPages={Math.ceil(documents?.total / 50)}
        onPageChange={/* ... */}
      />
    </div>
  )
}
```

## Document Viewer

PDF and image viewer with zoom, pan, and rotation.

### Features

| Feature | Description |
|---------|-------------|
| PDF viewing | Page navigation, page count |
| Image viewing | PNG, JPG, GIF, WebP, TIFF, BMP |
| Zoom | Pinch/scroll zoom, zoom controls |
| Pan | Click and drag to pan |
| Rotation | Rotate 90 degrees clockwise/counter-clockwise |

### Implementation

```tsx
// src/client/components/document-viewer.tsx
import { Document, Page } from 'react-pdf'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'

export function DocumentViewer({ document }) {
  const [page, setPage] = useState(1)
  const [numPages, setNumPages] = useState(1)

  const fileUrl = `/api/documents/${document?.id}/file`

  if (!document) {
    return <Empty>No document selected</Empty>
  }

  const isPdf = document.filename.endsWith('.pdf')

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center gap-2 p-2 border-b">
        {isPdf && (
          <>
            <Button onClick={() => setPage(p => Math.max(1, p - 1))}>
              <ChevronLeft />
            </Button>
            <span>Page {page} of {numPages}</span>
            <Button onClick={() => setPage(p => Math.min(numPages, p + 1))}>
              <ChevronRight />
            </Button>
          </>
        )}
        <Button onClick={/* rotate */}>
          <RotateCw />
        </Button>
      </div>

      {/* Viewer */}
      <TransformWrapper>
        <TransformComponent>
          {isPdf ? (
            <Document
              file={fileUrl}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            >
              <Page pageNumber={page} />
            </Document>
          ) : (
            <img src={fileUrl} alt={document.filename} />
          )}
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}
```

## Keyboard Shortcuts

### Document Processor Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl+S` | Save document | Always |
| `Ctrl+Enter` | Approve + next | Always |
| `Ctrl+Shift+Enter` | Approve (stay) | Always |
| `Ctrl+P` | Process document | Not in input |
| `Ctrl+R` | Reject document | Not in input |
| `Ctrl+Down` | Next document | Not in input |
| `Ctrl+Up` | Previous document | Not in input |

### Implementation

```tsx
// src/client/hooks/use-keyboard-shortcuts.ts
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' ||
                      target.tagName === 'TEXTAREA' ||
                      target.isContentEditable

      // Ctrl+S always works
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        handlers.onSave?.()
        return
      }

      // Other shortcuts only when not in input
      if (isInput) return

      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault()
        handlers.onProcess?.()
      }

      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) {
          handlers.onApproveStay?.()
        } else {
          handlers.onApproveNext?.()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlers])
}
```

## WebSocket Integration

### Connection Hook

```tsx
// src/client/lib/ws.ts
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws'

export function useDocumentUpdates(documentId: string | null) {
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!documentId) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', channel: documentId }))
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case 'progress':
          // Update cache with partial data
          queryClient.setQueryData(['document', documentId], (old: any) => ({
            ...old,
            _processing: true,
            _progress: data.progress,
            extractedData: data.partialData,
          }))
          break

        case 'completed':
          queryClient.invalidateQueries({ queryKey: ['document', documentId] })
          queryClient.invalidateQueries({ queryKey: ['documents'] })
          break

        case 'failed':
          queryClient.invalidateQueries({ queryKey: ['document', documentId] })
          break
      }
    }

    return () => {
      ws.send(JSON.stringify({ type: 'unsubscribe', channel: documentId }))
      ws.close()
    }
  }, [documentId, queryClient])

  const cancel = (jobId: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'cancel', jobId }))
  }

  return { cancel }
}
```

### Job Status Hook

```tsx
// src/client/lib/ws.ts
export function useJobStatuses(documentIds: string[]) {
  const [statuses, setStatuses] = useState<Record<string, JobStatus>>({})

  useEffect(() => {
    if (documentIds.length === 0) return

    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      for (const id of documentIds) {
        ws.send(JSON.stringify({ type: 'subscribe', channel: id }))
      }
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'progress' || data.type === 'started') {
        setStatuses(prev => ({
          ...prev,
          [data.documentId]: {
            status: 'processing',
            progress: data.progress || 0,
          },
        }))
      }

      if (data.type === 'completed' || data.type === 'failed') {
        setStatuses(prev => {
          const next = { ...prev }
          delete next[data.documentId]
          return next
        })
      }
    }

    return () => ws.close()
  }, [documentIds.join(',')])

  return statuses
}
```

## Theme System

### Theme Provider

```tsx
// src/client/components/theme-provider.tsx
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (theme: Theme) => void
}>({ theme: 'system', setTheme: () => {} })

export function ThemeProvider({ children, defaultTheme = 'system', storageKey }) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme: (t) => {
      localStorage.setItem(storageKey, t)
      setTheme(t)
    }}}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
```

## Loading States

### Document Processing

```tsx
{jobStatuses[doc.id]?.status === 'processing' ? (
  <Spinner className="text-blue-500" />
) : (
  <DocumentStatusIcon status={doc.status} />
)}
```

### Form Streaming

```tsx
<FormRenderer
  schema={schema}
  data={partialData}
  onChange={handleChange}
  isStreaming={isProcessing}  // Disables inputs
/>
```

## Toast Notifications

Using `sonner` for toast notifications (unchanged):

```typescript
import { toast } from 'sonner'

// Success
toast.success('Document approved!')

// Error
toast.error('Failed to process document')

// Info
toast.info('Processing started')
```

## File Locations (Target)

| Component | Path |
|-----------|------|
| UI Primitives | `src/client/components/ui/` |
| Document Processor | `src/client/components/document-processor.tsx` |
| Document Queue | `src/client/components/document-queue.tsx` |
| Document Viewer | `src/client/components/document-viewer.tsx` |
| Form Renderer | `src/client/components/form-renderer/` |
| Schema Builder | `src/client/components/schema-builder/` |
| Theme Provider | `src/client/components/theme-provider.tsx` |
| WebSocket Client | `src/client/lib/ws.ts` |
| TanStack Queries | `src/client/queries/` |
| Routes | `src/client/routes/` |
