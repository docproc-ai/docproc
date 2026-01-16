import { Link, Outlet, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useCallback, useRef, useEffect, useState } from 'react'
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
  useDocument,
  useDocuments,
  useProcessDocument,
  useProcessDocumentStreaming,
  useDeleteDocument,
  useCreateBatch,
  useUpdateDocument,
  useActiveJobs,
} from '@/lib/queries'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/lib/auth'
import { ButtonGroup } from '@/components/ui/button-group'
import { ModelSelector } from '@/components/model-selector'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Kbd } from '@/components/ui/kbd'
import {
  useDocumentTypeLiveUpdates,
  useWebSocketStatus,
  useJobEvents,
} from '@/lib/websocket'
import { useDebounce } from '@/lib/hooks'
import { DocumentEditorProvider } from '@/lib/document-editor-context'

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
  isProcessing,
  onSelect,
  onCheck,
  registerRef,
}: {
  doc: { id: string; filename: string; slug: string | null; status: string | null; createdAt: string | null }
  isSelected: boolean
  isChecked: boolean
  isProcessing: boolean
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
        <StatusIcon status={isProcessing ? 'processing' : (doc.status || 'pending')} />
      </div>
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 text-left py-3 pr-3 pl-2 min-w-0"
      >
        <p className="text-sm font-medium truncate">{doc.slug || doc.filename}</p>
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

export default function ProcessLayout() {
  const params = useParams({ strict: false })
  const slug = params.slug as string
  const selectedDocId = params.id as string | undefined
  const navigate = useNavigate()

  // URL search params for shareable state
  const { q: urlSearch, status: urlStatus, page: urlPage } = useSearch({
    from: '/document-types/$slug/process',
  })

  // Local state for controlled input (syncs to URL on debounce)
  const [searchInput, setSearchInput] = useState(urlSearch)
  const debouncedSearch = useDebounce(searchInput, 300)

  // Sync debounced search to URL
  useEffect(() => {
    if (debouncedSearch !== urlSearch) {
      navigate({
        search: (prev) => ({ ...prev, q: debouncedSearch || undefined, page: 1 }),
        replace: true,
      })
    }
  }, [debouncedSearch, urlSearch, navigate])

  // Update local input when URL changes (e.g., back/forward navigation)
  useEffect(() => {
    setSearchInput(urlSearch)
  }, [urlSearch])

  const [checkedDocIds, setCheckedDocIds] = useState<Set<string>>(new Set())
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [processingDocIds, setProcessingDocIds] = useState<Set<string>>(new Set())
  const documentRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Document action state (for header controls)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingDocId, setStreamingDocId] = useState<string | null>(null)
  const [modelOverride, setModelOverride] = useState('')
  const [streamingData, setStreamingData] = useState<Record<string, unknown> | null>(null)
  const abortStreamRef = useRef<(() => void) | null>(null)

  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  const { data: docType, isLoading: typeLoading } = useDocumentType(slug)
  const { data: currentDoc } = useDocument(selectedDocId || '')
  const { data: documentsData, refetch } = useDocuments(docType?.id || '', {
    page: urlPage,
    status: urlStatus,
    search: urlSearch || undefined,
  })

  const queryClient = useQueryClient()
  const processDocument = useProcessDocument()
  const { processWithStreaming, abort: abortStreaming } = useProcessDocumentStreaming()
  const deleteDocument = useDeleteDocument()
  const createBatch = useCreateBatch()
  const updateDocument = useUpdateDocument()

  // WebSocket for live updates
  const wsStatus = useWebSocketStatus()
  useDocumentTypeLiveUpdates(docType?.id)

  // Query active jobs for this document type (for page load)
  const { data: activeJobsData } = useActiveJobs(docType?.id)

  // Initialize processingDocIds from server on page load
  useEffect(() => {
    if (activeJobsData?.jobs) {
      const activeDocIds = new Set(activeJobsData.jobs.map((j: { documentId: string }) => j.documentId))
      setProcessingDocIds((prev) => {
        // Merge with existing WebSocket-tracked ids
        const merged = new Set([...prev, ...activeDocIds])
        return merged.size !== prev.size ? merged : prev
      })
    }
  }, [activeJobsData])

  // Track processing state from WebSocket events (real-time updates)
  useJobEvents(
    useCallback((event) => {
      if (!event.documentId) return

      if (event.type === 'job:started') {
        setProcessingDocIds((prev) => new Set(prev).add(event.documentId!))
      } else if (event.type === 'job:completed' || event.type === 'job:failed') {
        setProcessingDocIds((prev) => {
          const next = new Set(prev)
          next.delete(event.documentId!)
          return next
        })
      }
    }, []),
    [docType?.id]
  )

  // Documents from server (already filtered/paginated)
  const documents = documentsData?.documents || []

  // Scroll to selected document when it changes or documents load
  useEffect(() => {
    if (selectedDocId && documentRefs.current.has(selectedDocId)) {
      const element = documentRefs.current.get(selectedDocId)
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }, 100)
      }
    }
  }, [selectedDocId, documents])

  // Auto-select first document if none selected
  useEffect(() => {
    if (!selectedDocId && documents.length > 0 && docType?.slug) {
      navigate({
        to: '/document-types/$slug/process/$id',
        params: { slug: docType.slug, id: documents[0].id },
        search: (prev) => prev, // Preserve search params
        replace: true,
      })
    }
  }, [selectedDocId, documents, docType?.slug, navigate])

  const handleSelectDoc = useCallback((docId: string) => {
    if (docType?.slug) {
      navigate({
        to: '/document-types/$slug/process/$id',
        params: { slug: docType.slug, id: docId },
        search: (prev) => prev, // Preserve search params
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
    if (checkedDocIds.size === documents.length) {
      setCheckedDocIds(new Set())
    } else {
      setCheckedDocIds(new Set(documents.map((d) => d.id)))
    }
  }, [checkedDocIds.size, documents])

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

    const idsToProcess = Array.from(checkedDocIds)

    // Immediately mark as processing in local state
    setProcessingDocIds((prev) => {
      const next = new Set(prev)
      for (const id of idsToProcess) {
        next.add(id)
      }
      return next
    })

    try {
      await createBatch.mutateAsync({
        documentTypeId: docType.id,
        documentIds: idsToProcess,
      })

      setCheckedDocIds(new Set())
    } catch (error) {
      console.error('Batch processing failed:', error)
      // Revert optimistic update on error
      setProcessingDocIds((prev) => {
        const next = new Set(prev)
        for (const id of idsToProcess) {
          next.delete(id)
        }
        return next
      })
      // Fallback to individual processing
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

  // Document action handlers (for header controls)
  const handleProcess = useCallback(async () => {
    if (!currentDoc) return

    setIsStreaming(true)
    setStreamingDocId(currentDoc.id)
    setStreamingData({})
    abortStreamRef.current = abortStreaming

    // Mark as processing in local state
    setProcessingDocIds((prev) => new Set(prev).add(currentDoc.id))

    try {
      await processWithStreaming(
        currentDoc.id,
        modelOverride || undefined,
        (partialData) => {
          setStreamingData({ ...partialData })
        },
        (completeData) => {
          setStreamingData({ ...completeData })
        },
        (error) => {
          console.error('Processing error:', error)
        },
      )
    } finally {
      setIsStreaming(false)
      setStreamingDocId(null)
      abortStreamRef.current = null
      // Remove from processing state when done
      setProcessingDocIds((prev) => {
        const next = new Set(prev)
        next.delete(currentDoc.id)
        return next
      })
    }
  }, [currentDoc, modelOverride, processWithStreaming, abortStreaming])

  const handleStop = useCallback(() => {
    abortStreamRef.current?.()
    setIsStreaming(false)
    setStreamingDocId(null)
    abortStreamRef.current = null
  }, [])

  const handleApprove = useCallback(async () => {
    if (!currentDoc) return
    await updateDocument.mutateAsync({
      id: currentDoc.id,
      data: { status: 'approved' },
    })
  }, [currentDoc, updateDocument])

  const handleUnapprove = useCallback(async () => {
    if (!currentDoc) return
    await updateDocument.mutateAsync({
      id: currentDoc.id,
      data: { status: 'processed' },
    })
  }, [currentDoc, updateDocument])

  const handleReject = useCallback(async () => {
    if (!currentDoc) return
    await updateDocument.mutateAsync({
      id: currentDoc.id,
      data: { status: 'rejected' },
    })
  }, [currentDoc, updateDocument])

  // Clear streaming data when document changes
  useEffect(() => {
    setStreamingData(null)
    setIsStreaming(false)
  }, [selectedDocId])

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
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background gap-4">
        {/* Left side: nav + doc type info */}
        <div className="flex items-center gap-3 shrink-0">
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
          {/* Upload button */}
          <label className="cursor-pointer">
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.tiff"
              className="hidden"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            />
            <Button variant="outline" size="sm" asChild>
              <span className="flex items-center gap-2">
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
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" x2="12" y1="3" y2="15" />
                </svg>
                Upload
              </span>
            </Button>
          </label>
        </div>

        {/* Right side: document-specific controls */}
        {currentDoc && (
          <div className="flex items-center gap-2">
            {/* Model selector - admin only */}
            {isAdmin && (
              <ModelSelector
                value={modelOverride || docType?.modelName || ''}
                onChange={setModelOverride}
                placeholder={docType?.modelName || 'Default model'}
              />
            )}

            {/* Process/Stop ButtonGroup */}
            {selectedDocId && processingDocIds.has(selectedDocId) ? (
              <Button variant="outline" size="sm" onClick={handleStop}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="mr-1"
                >
                  <rect x="6" y="6" width="12" height="12" />
                </svg>
                Stop
              </Button>
            ) : (
              <ButtonGroup>
                <Button variant="outline" size="sm" onClick={handleProcess} disabled={!currentDoc}>
                  Process
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={!currentDoc}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleProcess}>
                      Force Process
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </ButtonGroup>
            )}

            {/* Approve/Unapprove ButtonGroup */}
            <ButtonGroup>
              {currentDoc.status === 'approved' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleUnapprove}
                  disabled={updateDocument.isPending}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M3 7v6h6" />
                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                  </svg>
                  Unapprove
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={updateDocument.isPending || (selectedDocId && processingDocIds.has(selectedDocId))}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Approve
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    className={`h-8 w-8 ${currentDoc.status === 'approved' ? '' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                    disabled={updateDocument.isPending}
                    variant={currentDoc.status === 'approved' ? 'secondary' : 'default'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleReject}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="m15 9-6 6" />
                      <path d="m9 9 6 6" />
                    </svg>
                    Reject
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>

            {/* Keyboard Help Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Keyboard shortcuts">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 8h.01" />
                    <path d="M12 12h.01" />
                    <path d="M14 8h.01" />
                    <path d="M16 12h.01" />
                    <path d="M18 8h.01" />
                    <path d="M6 8h.01" />
                    <path d="M7 16h10" />
                    <path d="M8 12h.01" />
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                  </svg>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <h4 className="font-medium mb-2">Keyboard Shortcuts</h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Approve</span> <span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd></span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Process</span> <span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd>+<Kbd>P</Kbd></span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Reject</span> <span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd>+<Kbd>R</Kbd></span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Next doc</span> <span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd>+<Kbd>↓</Kbd></span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Prev doc</span> <span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd>+<Kbd>↑</Kbd></span></div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
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
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-9"
              />
              <ToggleGroup
                type="single"
                value={urlStatus}
                onValueChange={(value: string) => {
                  if (value) {
                    navigate({
                      search: (prev) => ({ ...prev, status: value, page: 1 }),
                      replace: true,
                    })
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
                  checked={checkedDocIds.size === documents.length && documents.length > 0}
                  onCheckedChange={() => handleSelectAll()}
                />
                <span className="text-xs text-muted-foreground">
                  {checkedDocIds.size > 0
                    ? `${checkedDocIds.size} selected`
                    : 'Select all'}
                </span>
                {/* Processing count */}
                {(() => {
                  const processingCount = documents.filter(d => processingDocIds.has(d.id)).length
                  return processingCount > 0 ? (
                    <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                      <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      {processingCount}
                    </span>
                  ) : null
                })()}
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

            {/* Document list (dropzone) */}
            <div
              className={`flex-1 overflow-y-auto relative transition-colors ${
                isDragOver ? 'bg-primary/5' : ''
              }`}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragOver(false)
                if (e.dataTransfer.files.length > 0) {
                  handleFileUpload(e.dataTransfer.files)
                }
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={(e) => {
                // Only set false if leaving the container (not entering a child)
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setIsDragOver(false)
                }
              }}
            >
              {/* Drag overlay */}
              {isDragOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg m-2 pointer-events-none z-10">
                  <span className="text-sm font-medium text-primary">Drop files to upload</span>
                </div>
              )}
              {documents.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {isUploading ? 'Uploading...' : 'No documents - drag files here to upload'}
                </div>
              ) : (
                documents.map((doc) => (
                  <DocumentListItem
                    key={doc.id}
                    doc={doc}
                    isSelected={selectedDocId === doc.id}
                    isChecked={checkedDocIds.has(doc.id)}
                    isProcessing={processingDocIds.has(doc.id)}
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

            {/* Pagination */}
            <div className="px-3 py-2 border-t flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => navigate({
                  search: (prev) => ({ ...prev, page: Math.max(1, urlPage - 1) }),
                  replace: true,
                })}
                disabled={urlPage <= 1}
                className="px-2 py-1 rounded hover:bg-muted disabled:opacity-50"
              >
                ‹
              </button>
              <span className="text-muted-foreground">
                {urlPage} / {documentsData?.pagination?.totalPages || 1}
              </span>
              <button
                type="button"
                onClick={() => navigate({
                  search: (prev) => ({ ...prev, page: urlPage + 1 }),
                  replace: true,
                })}
                disabled={!documentsData?.pagination || urlPage >= documentsData.pagination.totalPages}
                className="px-2 py-1 rounded hover:bg-muted disabled:opacity-50"
              >
                ›
              </button>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Middle + Right: Child route (editor + preview) */}
        <ResizablePanel defaultSize={80} minSize={50}>
          <DocumentEditorProvider
            streamingData={streamingDocId === selectedDocId ? streamingData : null}
            isStreaming={selectedDocId ? processingDocIds.has(selectedDocId) : false}
          >
            <Outlet />
          </DocumentEditorProvider>
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
