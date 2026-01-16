import { Link, Outlet, useNavigate, useParams } from '@tanstack/react-router'
import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import {
  useDocumentType,
  useDocuments,
  useProcessDocument,
  useDeleteDocument,
  useCreateBatch,
  useUpdateDocument,
} from '@/lib/queries'
import {
  useDocumentTypeLiveUpdates,
  useWebSocketStatus,
  useBatchSubscription,
} from '@/lib/websocket'

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

// Status icon - File-based icons
function StatusIcon({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-5 w-5' }
  const sizeClass = sizeClasses[size]

  const icons: Record<string, { icon: React.ReactNode; title: string }> = {
    pending: {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${sizeClass} text-muted-foreground`}>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        </svg>
      ),
      title: 'Pending',
    },
    processing: {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${sizeClass} text-blue-500 animate-spin`}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ),
      title: 'Processing',
    },
    processed: {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${sizeClass} text-blue-500`}>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1" />
          <path d="M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1" />
        </svg>
      ),
      title: 'Processed',
    },
    approved: {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${sizeClass} text-green-500`}>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="m9 15 2 2 4-4" />
        </svg>
      ),
      title: 'Approved',
    },
    rejected: {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${sizeClass} text-red-500`}>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="m14.5 12.5-5 5" />
          <path d="m9.5 12.5 5 5" />
        </svg>
      ),
      title: 'Rejected',
    },
  }

  const config = icons[status] || icons.pending

  return (
    <span className="shrink-0" title={config.title}>
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
  registerRef,
}: {
  doc: { id: string; filename: string; status: string | null; createdAt: string | null }
  isSelected: boolean
  isChecked: boolean
  onSelect: () => void
  onCheck: (checked: boolean) => void
  registerRef: (id: string, el: HTMLDivElement | null) => void
}) {
  return (
    <div
      ref={(el) => registerRef(doc.id, el)}
      className={`flex items-center w-full border-b transition-colors ${
        isSelected
          ? 'bg-primary/10 border-l-2 border-l-primary'
          : 'hover:bg-muted/50'
      }`}
    >
      <div className="pl-3 py-3 self-center">
        <Checkbox
          checked={isChecked}
          onCheckedChange={(checked) => onCheck(checked === true)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <div className="pl-2 self-center">
        <StatusIcon status={doc.status || 'pending'} />
      </div>
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 text-left py-3 pr-3 pl-2 min-w-0"
      >
        <p className="text-sm font-medium truncate">{doc.filename}</p>
        {doc.createdAt && (
          <p className="text-xs text-muted-foreground mt-0.5">
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

// Upload drop zone
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
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          inputRef.current?.click()
        }
      }}
      role="button"
      tabIndex={0}
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

export default function ProcessLayout() {
  const params = useParams({ strict: false })
  const slug = params.slug as string
  const selectedDocId = params.id as string | undefined
  const navigate = useNavigate()

  const [checkedDocIds, setCheckedDocIds] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [isUploading, setIsUploading] = useState(false)
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const documentRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const { data: docType, isLoading: typeLoading } = useDocumentType(slug)
  const { data: documentsData, refetch } = useDocuments(docType?.id || '', {
    page,
    status: statusFilter,
  })

  const processDocument = useProcessDocument()
  const deleteDocument = useDeleteDocument()
  const createBatch = useCreateBatch()
  const updateDocument = useUpdateDocument()

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

  // Scroll to selected document when it changes
  useEffect(() => {
    if (selectedDocId && documentRefs.current.has(selectedDocId)) {
      const element = documentRefs.current.get(selectedDocId)
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }, 100)
      }
    }
  }, [selectedDocId])

  // Auto-select first document if none selected
  useEffect(() => {
    if (!selectedDocId && filteredDocs.length > 0 && docType?.slug) {
      navigate({
        to: '/document-types/$slug/process/$id',
        params: { slug: docType.slug, id: filteredDocs[0].id },
        replace: true,
      })
    }
  }, [selectedDocId, filteredDocs, docType?.slug, navigate])

  const handleSelectDoc = useCallback((docId: string) => {
    if (docType?.slug) {
      navigate({
        to: '/document-types/$slug/process/$id',
        params: { slug: docType.slug, id: docId },
      })
    }
  }, [docType?.slug, navigate])

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

  const handleBulkDelete = useCallback(() => {
    if (checkedDocIds.size === 0) return
    setShowDeleteDialog(true)
  }, [checkedDocIds.size])

  const confirmBulkDelete = useCallback(async () => {
    for (const id of checkedDocIds) {
      await deleteDocument.mutateAsync(id)
    }
    setCheckedDocIds(new Set())
    setShowDeleteDialog(false)
  }, [checkedDocIds, deleteDocument])

  const handleBulkProcess = useCallback(async () => {
    if (checkedDocIds.size === 0 || !docType?.id) return

    try {
      const result = await createBatch.mutateAsync({
        documentTypeId: docType.id,
        documentIds: Array.from(checkedDocIds),
      })

      if (result?.batchId) {
        setActiveBatchId(result.batchId)
      }

      setCheckedDocIds(new Set())
    } catch (error) {
      console.error('Batch processing failed:', error)
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
                    type="button"
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
                <ToggleGroupItem value="all" className="flex-1" aria-label="All documents">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M20 7h-3a2 2 0 0 1-2-2V2" />
                    <path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z" />
                    <path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8" />
                  </svg>
                </ToggleGroupItem>
                <ToggleGroupItem value="pending" className="flex-1" aria-label="Pending">
                  <StatusIcon status="pending" size="sm" />
                </ToggleGroupItem>
                <ToggleGroupItem value="processed" className="flex-1" aria-label="Processed">
                  <StatusIcon status="processed" size="sm" />
                </ToggleGroupItem>
                <ToggleGroupItem value="approved" className="flex-1" aria-label="Approved">
                  <StatusIcon status="approved" size="sm" />
                </ToggleGroupItem>
                <ToggleGroupItem value="rejected" className="flex-1" aria-label="Rejected">
                  <StatusIcon status="rejected" size="sm" />
                </ToggleGroupItem>
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
                    isSelected={selectedDocId === doc.id}
                    isChecked={checkedDocIds.has(doc.id)}
                    onSelect={() => handleSelectDoc(doc.id)}
                    onCheck={(checked) => handleToggleCheck(doc.id, checked)}
                    registerRef={(id, el) => {
                      if (el) {
                        documentRefs.current.set(id, el)
                      } else {
                        documentRefs.current.delete(id)
                      }
                    }}
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
                  type="button"
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
                  type="button"
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

        {/* Middle + Right: Child route (editor + preview) */}
        <ResizablePanel defaultSize={80} minSize={50}>
          <Outlet />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Documents</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {checkedDocIds.size} document(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
