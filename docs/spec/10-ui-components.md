# UI Components

## Overview

DocProc's UI is built with React, shadcn/ui components, and Tailwind CSS. This document covers the main application components and user interface features.

## Component Architecture

```
src/components/
├── ui/                     # shadcn/ui primitives (40+ components)
├── document-processor.tsx  # Main processing interface
├── document-queue.tsx      # Document list with filters
├── document-viewer.tsx     # PDF/image viewer
├── form-renderer/          # Dynamic form generation
├── schema-builder/         # Visual schema editor
├── webhook-config.tsx      # Webhook configuration
├── theme-toggle.tsx        # Dark/light mode
└── ...
```

## Document Processor

The main interface for processing and reviewing documents.

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Header: Back | Document Name | Model Select | Actions | Theme       │
├───────────────┬───────────────────────────────┬─────────────────────┤
│               │                               │                     │
│   Document    │         Form / Data           │    Document         │
│    Queue      │          Editor               │     Viewer          │
│               │                               │                     │
│  (Resizable)  │        (Resizable)            │   (Resizable)       │
│               │                               │                     │
└───────────────┴───────────────────────────────┴─────────────────────┘
```

### Features

- **Resizable Panels**: Drag handles between panels
- **Panel Persistence**: Sizes saved to localStorage
- **Tab Views**: Form and Data (JSON) tabs
- **Unsaved Changes**: Warning dialog on navigation
- **Keyboard Shortcuts**: See below

### State Management

```typescript
// Key state
const [documents, setDocuments] = useState<Document[]>([])
const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
const [formData, setFormData] = useState<any>(null)
const [processingDocuments, setProcessingDocuments] = useState<Set<string>>(new Set())
```

### Location

`src/components/document-processor.tsx`

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
| Processing indicators | Spinner for active, clock for queued |
| Drag & drop upload | Drop files to upload |

### Status Icons

| Status | Icon | Color |
|--------|------|-------|
| Pending | `CircleDashed` | Gray |
| Processed | `CheckCircle2` | Blue |
| Approved | `BadgeCheck` | Green |
| Rejected | `XCircle` | Red |
| Processing | `Spinner` | Blue (animated) |
| Queued | `Clock` | Orange |

### Bulk Actions

- Process selected documents
- Delete selected documents
- Change status (pending, processed, approved, rejected)

### Location

`src/components/document-queue.tsx`

## Document Viewer

PDF and image viewer with zoom, pan, and rotation.

### Features

| Feature | Description |
|---------|-------------|
| PDF viewing | Page navigation, page count |
| Image viewing | PNG, JPG, GIF, WebP, TIFF, BMP |
| Zoom | Pinch/scroll zoom, zoom controls |
| Pan | Click and drag to pan |
| Rotation | Rotate 90° clockwise/counter-clockwise |

### PDF Navigation

```
┌─────────────────────────────────────────┐
│  [◀] Page 1 of 5 [▶]  [↻] [↺] [−] [+]   │
├─────────────────────────────────────────┤
│                                         │
│                                         │
│           Document Content              │
│                                         │
│                                         │
└─────────────────────────────────────────┘
```

### Implementation

- **PDF Rendering**: `react-pdf` with PDF.js
- **Zoom/Pan**: `react-zoom-pan-pinch`
- **Rotation**: Server-side file modification

### Location

`src/components/document-viewer.tsx`

## Keyboard Shortcuts

### Document Processor Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl+S` | Save document | Always |
| `Ctrl+Enter` | Approve + next | Always |
| `Ctrl+Shift+Enter` | Approve (stay) | Always |
| `Ctrl+P` | Process document | Not in input |
| `Ctrl+R` | Reject document | Not in input |
| `Ctrl+↓` | Next document | Not in input |
| `Ctrl+↑` | Previous document | Not in input |

### Shortcut Help

Click keyboard icon in header to show shortcut reference:

```
┌──────────────────────────────────┐
│ Keyboard Shortcuts               │
├──────────────────────────────────┤
│ Save            Ctrl + S         │
│ Approve & next  Ctrl + Enter     │
│ Approve & stay  Ctrl + Shift + Enter │
│ Process         Ctrl + P         │
│ Reject          Ctrl + R         │
│ Next document   Ctrl + ↓         │
│ Prev document   Ctrl + ↑         │
└──────────────────────────────────┘
```

### Implementation

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    const isInput = target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable

    // Ctrl+S always works
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault()
      handleSave()
      return
    }

    // Other shortcuts only when not in input
    if (isInput) return

    if (e.ctrlKey && e.key === 'p') {
      e.preventDefault()
      handleProcess()
    }
    // ...
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
})
```

## Theme System

### Toggle Component

```tsx
<ThemeToggle />
```

Cycles through: System → Light → Dark

### Implementation

- **Provider**: `next-themes`
- **Storage**: localStorage
- **CSS Variables**: Tailwind CSS theme tokens

### Theme Classes

```css
/* Light theme (default) */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  /* ... */
}

/* Dark theme */
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

## UI Component Library

DocProc uses [shadcn/ui](https://ui.shadcn.com/) components built on Radix UI primitives.

### Core Components Used

| Component | Usage |
|-----------|-------|
| Button | Actions, navigation |
| Input | Text fields |
| Select | Dropdowns |
| Checkbox | Multi-select, toggles |
| Dialog | Confirmations, forms |
| DropdownMenu | Context menus |
| Tabs | Form/Data view toggle |
| Table | Array field tables |
| Popover | Tooltips, help |
| AlertDialog | Destructive confirmations |
| ResizablePanel | Layout panels |
| Pagination | Document list navigation |

### Custom Components

| Component | Purpose |
|-----------|---------|
| `Spinner` | Loading indicator |
| `Empty` | Empty state display |
| `Field` | Form field wrapper |
| `Item` | List item wrapper |
| `Kbd` | Keyboard key display |
| `ButtonGroup` | Grouped buttons |
| `InputGroup` | Input with button |

## Responsive Design

### Breakpoints

```css
/* Tailwind defaults */
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

### Container Queries

Document queue uses container queries for adaptive layout:

```tsx
<div className="@container">
  <div className="@sm:flex-row flex-col">
    {/* Adapts based on container width */}
  </div>
</div>
```

## Loading States

### Document Processing

```tsx
{processingDocuments.has(doc.id) ? (
  <Spinner className="text-blue-500" />
) : documentJobStatuses[doc.id]?.status === 'waiting' ? (
  <Clock className="text-orange-500" />
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

### Button Loading

```tsx
<Button disabled={isPending}>
  {isPending ? <Spinner /> : <CheckCircle />}
  Approve
</Button>
```

## Empty States

Consistent empty state component:

```tsx
<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon">
      <MousePointerClick />
    </EmptyMedia>
    <EmptyTitle>No document selected</EmptyTitle>
    <EmptyDescription>
      Select a document from the sidebar to view and edit.
    </EmptyDescription>
  </EmptyHeader>
</Empty>
```

## Toast Notifications

Using `sonner` for toast notifications:

```typescript
import { toast } from 'sonner'

// Success
toast.success('Document approved!')

// Error
toast.error('Failed to process document')

// Info
toast.info('Processing started')
```

## File Locations

| Component | Path |
|-----------|------|
| UI Primitives | `src/components/ui/` |
| Document Processor | `src/components/document-processor.tsx` |
| Document Queue | `src/components/document-queue.tsx` |
| Document Viewer | `src/components/document-viewer.tsx` |
| Form Renderer | `src/components/form-renderer/` |
| Schema Builder | `src/components/schema-builder/` |
| Theme Toggle | `src/components/theme-toggle.tsx` |
| Status Icons | `src/components/document-status-icon.tsx` |
