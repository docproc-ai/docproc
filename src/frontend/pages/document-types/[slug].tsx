import { Link, useParams } from '@tanstack/react-router'
import { useState, useCallback, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import {
  useDocumentType,
  useDocuments,
  useDocument,
  useProcessDocument,
  useProcessDocumentStreaming,
  useUpdateDocument,
  useDeleteDocument,
  useCreateBatch,
} from '@/lib/queries'
import {
  useDocumentTypeLiveUpdates,
  useWebSocketStatus,
  useBatchSubscription,
} from '@/lib/websocket'
import { useSession } from '@/lib/auth'
import { FormRenderer } from '@/components/form-renderer'
import { ModelSelector } from '@/components/model-selector'
import type { JsonSchema } from '@/components/schema-builder/types'

// WebSocket connection indicator
function ConnectionIndicator({ status }: { status: string }) {
  const statusConfig: Record<string, { color: string; title: string }> = {
    connected: { color: 'bg-green-500', title: 'Live updates connected' },
    connecting: { color: 'bg-amber-500 animate-pulse', title: 'Connecting...' },
    disconnected: { color: 'bg-gray-400', title: 'Disconnected' },
    error: { color: 'bg-red-500', title: 'Connection error' },
  }
  const config = statusConfig[status] || statusConfig.disconnected

  return (
    <span
      className={`w-2 h-2 rounded-full ${config.color}`}
      title={config.title}
    />
  )
}

// Status icon - compact colored icons instead of text badges
function StatusIcon({ status }: { status: string }) {
  const icons: Record<string, { icon: React.ReactNode; className: string; title: string }> = {
    pending: {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      className: 'text-amber-500',
      title: 'Pending',
    },
    processing: {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ),
      className: 'text-purple-500',
      title: 'Processing',
    },
    processed: {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
      className: 'text-blue-500',
      title: 'Processed',
    },
    approved: {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
      ),
      className: 'text-green-500',
      title: 'Approved',
    },
    rejected: {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
        </svg>
      ),
      className: 'text-red-500',
      title: 'Rejected',
    },
  }

  const config = icons[status] || icons.pending

  return (
    <span className={`shrink-0 ${config.className}`} title={config.title}>
      {config.icon}
    </span>
  )
}

// Document list item in sidebar
function DocumentListItem({
  doc,
  isSelected,
  isChecked,
  onSelect,
  onCheck,
}: {
  doc: { id: string; filename: string; status: string | null; createdAt: string | null }
  isSelected: boolean
  isChecked: boolean
  onSelect: () => void
  onCheck: (checked: boolean) => void
}) {
  return (
    <div
      className={`flex items-center w-full border-b transition-colors ${
        isSelected
          ? 'bg-primary/10 border-l-2 border-l-primary'
          : 'hover:bg-muted/50'
      }`}
    >
      <div className="pl-3 py-3">
        <Checkbox
          checked={isChecked}
          onCheckedChange={(checked) => onCheck(checked === true)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <button
        onClick={onSelect}
        className="flex-1 text-left py-3 pr-3 pl-2 min-w-0"
      >
        <div className="flex items-center gap-2">
          <StatusIcon status={doc.status || 'pending'} />
          <p className="text-sm font-medium truncate flex-1">{doc.filename}</p>
        </div>
        {doc.createdAt && (
          <p className="text-xs text-muted-foreground mt-0.5 pl-[22px]">
            {new Date(doc.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        )}
      </button>
    </div>
  )
}


// Document preview panel
function DocumentPreview({ documentId, filename }: { documentId: string; filename: string }) {
  const isPdf = filename.toLowerCase().endsWith('.pdf')

  return (
    <div className="h-full bg-muted/30 flex items-center justify-center">
      {isPdf ? (
        <iframe
          src={`/api/documents/${documentId}/file`}
          className="w-full h-full"
          title="Document preview"
        />
      ) : (
        <img
          src={`/api/documents/${documentId}/file`}
          alt={filename}
          className="max-w-full max-h-full object-contain"
        />
      )}
    </div>
  )
}

// Upload drop zone (compact version for sidebar)
function UploadZone({
  onUpload,
  isUploading,
}: {
  onUpload: (files: FileList) => void
  isUploading: boolean
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      if (e.dataTransfer.files.length > 0) {
        onUpload(e.dataTransfer.files)
      }
    },
    [onUpload]
  )

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer ${
        isDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
      }`}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.tiff"
        className="hidden"
        onChange={(e) => e.target.files && onUpload(e.target.files)}
      />
      {isUploading ? (
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Uploading...</span>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          Drop files or click to upload
        </div>
      )}
    </div>
  )
}

export default function DocumentTypeDetailPage() {
  const params = useParams({ strict: false })
  const slug = params.slug as string

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [checkedDocIds, setCheckedDocIds] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [isUploading, setIsUploading] = useState(false)
  const [editedData, setEditedData] = useState<Record<string, unknown>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null)
  const [modelOverride, setModelOverride] = useState('')

  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  const { data: docType, isLoading: typeLoading } = useDocumentType(slug)
  const { data: documentsData, refetch } = useDocuments(docType?.id || '', {
    page,
    status: statusFilter,
  })
  const { data: selectedDoc } = useDocument(selectedDocId || '')

  const processDocument = useProcessDocument()
  const { processWithStreaming } = useProcessDocumentStreaming()
  const updateDocument = useUpdateDocument()
  const deleteDocument = useDeleteDocument()
  const createBatch = useCreateBatch()

  // WebSocket for live updates
  const wsStatus = useWebSocketStatus()
  useDocumentTypeLiveUpdates(docType?.id)
  const { progress: batchProgress } = useBatchSubscription(activeBatchId || undefined)

  // Filter documents by search
  const filteredDocs = useMemo(() => {
    if (!documentsData?.documents) return []
    if (!searchQuery) return documentsData.documents
    return documentsData.documents.filter((d) =>
      d.filename.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [documentsData?.documents, searchQuery])

  // Auto-select first document or update edited data when selection changes
  const currentDoc = selectedDoc || (filteredDocs.length > 0 ? filteredDocs[0] : null)

  // Get schema for form rendering
  const schema = (selectedDoc?.schemaSnapshot || docType?.schema || {}) as JsonSchema

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false)

  // Update edited data when document changes
  const handleSelectDoc = useCallback((docId: string) => {
    setSelectedDocId(docId)
    setHasChanges(false)
  }, [])

  // Initialize edited data when document loads
  const docExtractedData = selectedDoc?.extractedData as Record<string, unknown> | null
  if (selectedDoc && !hasChanges && !isStreaming && JSON.stringify(editedData) !== JSON.stringify(docExtractedData || {})) {
    setEditedData(docExtractedData || {})
  }

  const handleFileUpload = useCallback(
    async (files: FileList) => {
      if (!docType) return
      setIsUploading(true)
      const formData = new FormData()
      for (const file of files) {
        formData.append('files', file)
      }
      try {
        const res = await fetch(`/api/document-types/${docType.slug}/upload`, {
          method: 'POST',
          body: formData,
        })
        if (res.ok) {
          refetch()
        }
      } catch (err) {
        console.error('Upload failed:', err)
      } finally {
        setIsUploading(false)
      }
    },
    [docType, refetch]
  )

  const handleProcess = async () => {
    if (!currentDoc) return

    setIsStreaming(true)
    setEditedData({}) // Clear existing data to show streaming effect
    setHasChanges(false)

    try {
      await processWithStreaming(
        currentDoc.id,
        modelOverride || undefined,
        // onPartial - update form with streaming data
        (partialData) => {
          setEditedData({ ...partialData })
        },
        // onComplete - final data
        (completeData) => {
          setEditedData({ ...completeData })
          setHasChanges(false)
        },
        // onError
        (error) => {
          console.error('Processing error:', error)
        },
      )
    } finally {
      setIsStreaming(false)
    }
  }

  const handleSave = async () => {
    if (!currentDoc) return
    await updateDocument.mutateAsync({
      id: currentDoc.id,
      data: { extractedData: editedData },
    })
    setHasChanges(false)
  }

  const handleApprove = async () => {
    if (!currentDoc) return
    await updateDocument.mutateAsync({
      id: currentDoc.id,
      data: { status: 'approved', extractedData: editedData },
    })
    setHasChanges(false)
    // Move to next document
    const currentIdx = filteredDocs.findIndex((d) => d.id === currentDoc.id)
    if (currentIdx < filteredDocs.length - 1) {
      handleSelectDoc(filteredDocs[currentIdx + 1].id)
    }
  }

  const handleReject = async () => {
    if (!currentDoc) return
    const reason = prompt('Rejection reason:')
    if (reason) {
      await updateDocument.mutateAsync({
        id: currentDoc.id,
        data: { status: 'rejected', rejectionReason: reason },
      })
      // Move to next document
      const currentIdx = filteredDocs.findIndex((d) => d.id === currentDoc.id)
      if (currentIdx < filteredDocs.length - 1) {
        handleSelectDoc(filteredDocs[currentIdx + 1].id)
      }
    }
  }

  // Bulk action handlers
  const handleToggleCheck = useCallback((docId: string, checked: boolean) => {
    setCheckedDocIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(docId)
      } else {
        next.delete(docId)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (checkedDocIds.size === filteredDocs.length) {
      setCheckedDocIds(new Set())
    } else {
      setCheckedDocIds(new Set(filteredDocs.map((d) => d.id)))
    }
  }, [checkedDocIds.size, filteredDocs])

  const handleBulkDelete = useCallback(async () => {
    if (checkedDocIds.size === 0) return
    if (!confirm(`Delete ${checkedDocIds.size} document(s)?`)) return

    for (const id of checkedDocIds) {
      await deleteDocument.mutateAsync(id)
    }
    setCheckedDocIds(new Set())
    setSelectedDocId(null)
  }, [checkedDocIds, deleteDocument])

  const handleBulkProcess = useCallback(async () => {
    if (checkedDocIds.size === 0 || !docType?.id) return

    try {
      // Use batch processing for multiple documents
      const result = await createBatch.mutateAsync({
        documentTypeId: docType.id,
        documentIds: Array.from(checkedDocIds),
      })

      // Subscribe to batch updates
      if (result?.batch?.id) {
        setActiveBatchId(result.batch.id)
      }

      setCheckedDocIds(new Set())
    } catch (error) {
      console.error('Batch processing failed:', error)
      // Fallback to sequential processing if batch fails
      for (const id of checkedDocIds) {
        await processDocument.mutateAsync({ documentId: id })
      }
      setCheckedDocIds(new Set())
    }
  }, [checkedDocIds, docType?.id, createBatch, processDocument])

  const handleBulkApprove = useCallback(async () => {
    if (checkedDocIds.size === 0) return

    for (const id of checkedDocIds) {
      await updateDocument.mutateAsync({ id, data: { status: 'approved' } })
    }
    setCheckedDocIds(new Set())
  }, [checkedDocIds, updateDocument])

  if (typeLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!docType) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="bg-destructive/10 text-destructive rounded-lg p-6">
          <h3 className="font-medium mb-1">Document type not found</h3>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-4">
          <Link
            to="/document-types"
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold">{docType.name}</h1>
                <Link
                  to="/document-types/$slug/settings"
                  params={{ slug: docType.slug }}
                  className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground"
                  title="Settings"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </Link>
                <ConnectionIndicator status={wsStatus} />
              </div>
              {currentDoc && (
                <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                  {currentDoc.filename}
                </p>
              )}
            </div>
            {/* Batch progress indicator */}
            {activeBatchId && batchProgress && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <div className="w-3 h-3 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                  Processing {batchProgress.completed}/{batchProgress.total}
                </span>
                {batchProgress.completed === batchProgress.total && (
                  <button
                    onClick={() => setActiveBatchId(null)}
                    className="ml-1 text-purple-500 hover:text-purple-700"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Model selector - admin only */}
          {isAdmin && (
            <div className="w-64">
              <ModelSelector
                value={modelOverride || docType.modelName || ''}
                onChange={setModelOverride}
                placeholder={docType.modelName || 'Default model'}
              />
            </div>
          )}

          {/* Process button */}
          <Button
            variant="outline"
            onClick={handleProcess}
            disabled={!currentDoc || isStreaming}
          >
            {isStreaming ? (
              <div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin" />
            ) : (
              'Process'
            )}
          </Button>

          {/* Approve button */}
          <Button
            onClick={handleApprove}
            disabled={!currentDoc || updateDocument.isPending || isStreaming}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Approve
          </Button>

          {/* Reject button */}
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={!currentDoc || updateDocument.isPending || isStreaming}
            className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            Reject
          </Button>
        </div>
      </div>

      {/* 3-pane layout */}
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1"
        autoSaveId="docproc:panel-sizes"
      >
        {/* Left: Document list */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <div className="h-full flex flex-col bg-background">
          {/* Search and filter */}
          <div className="p-3 border-b space-y-2">
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9"
            />
            <ToggleGroup
              type="single"
              value={statusFilter}
              onValueChange={(value: string) => {
                if (value) {
                  setStatusFilter(value)
                  setPage(1)
                }
              }}
              size="sm"
              className="w-full"
            >
              {['all', 'pending', 'processed', 'approved', 'rejected'].map((status) => (
                <ToggleGroupItem
                  key={status}
                  value={status}
                  className="flex-1 capitalize text-[11px]"
                  aria-label={`Filter by ${status}`}
                >
                  {status}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Bulk actions bar */}
          <div className="px-3 h-10 border-b bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={checkedDocIds.size === filteredDocs.length && filteredDocs.length > 0}
                onCheckedChange={() => handleSelectAll()}
              />
              <span className="text-xs text-muted-foreground">
                {checkedDocIds.size > 0
                  ? `${checkedDocIds.size} selected`
                  : 'Select all'}
              </span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={checkedDocIds.size === 0}
                >
                  Actions
                  <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="ml-1"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleBulkProcess}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mr-2"
                      >
                        <path d="M12 3v3" />
                        <path d="M18.5 13h-13" />
                        <path d="m6 10 1.5 7" />
                        <path d="m18 10-1.5 7" />
                        <circle cx="12" cy="18" r="2" />
                      </svg>
                      Process selected
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleBulkApprove}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mr-2"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Approve selected
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleBulkDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mr-2"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        <line x1="10" x2="10" y1="11" y2="17" />
                        <line x1="14" x2="14" y1="11" y2="17" />
                      </svg>
                      Delete selected
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
          </div>

          {/* Document list */}
          <div className="flex-1 overflow-y-auto">
            {filteredDocs.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No documents
              </div>
            ) : (
              filteredDocs.map((doc) => (
                <DocumentListItem
                  key={doc.id}
                  doc={doc}
                  isSelected={currentDoc?.id === doc.id}
                  isChecked={checkedDocIds.has(doc.id)}
                  onSelect={() => handleSelectDoc(doc.id)}
                  onCheck={(checked) => handleToggleCheck(doc.id, checked)}
                />
              ))
            )}
          </div>

          {/* Upload zone */}
          <div className="p-3 border-t">
            <UploadZone onUpload={handleFileUpload} isUploading={isUploading} />
          </div>

          {/* Pagination */}
          {documentsData?.pagination && documentsData.pagination.totalPages > 1 && (
            <div className="p-3 border-t flex items-center justify-between text-sm">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 rounded hover:bg-muted disabled:opacity-50"
              >
                ‹
              </button>
              <span className="text-muted-foreground">
                {page} / {documentsData.pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page === documentsData.pagination.totalPages}
                className="px-2 py-1 rounded hover:bg-muted disabled:opacity-50"
              >
                ›
              </button>
            </div>
          )}
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Middle: Form editor */}
        <ResizablePanel defaultSize={40} minSize={25}>
          <div className="h-full overflow-y-auto p-6 bg-background">
          {!currentDoc ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Select a document or upload files to get started
            </div>
          ) : (
            <div className="max-w-2xl space-y-6">
              {/* Streaming indicator */}
              {isStreaming && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span>Extracting data...</span>
                </div>
              )}

              {/* Form fields - always shown */}
              <FormRenderer
                schema={schema}
                data={editedData}
                onChange={(newData) => {
                  if (!isStreaming) {
                    setEditedData(newData)
                    setHasChanges(true)
                  }
                }}
                isStreaming={isStreaming}
              />

              {/* Save button if there are changes */}
              {hasChanges && (
                <div className="sticky bottom-0 py-4 bg-background border-t">
                  <Button onClick={handleSave} disabled={updateDocument.isPending}>
                    {updateDocument.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </div>
          )}
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right: Document preview */}
        <ResizablePanel defaultSize={40} minSize={25}>
          {currentDoc ? (
            <DocumentPreview documentId={currentDoc.id} filename={currentDoc.filename} />
          ) : (
            <div className="h-full flex items-center justify-center bg-muted/30 text-muted-foreground">
              No document selected
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
