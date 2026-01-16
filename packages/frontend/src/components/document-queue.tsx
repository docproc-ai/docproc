import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, X, ChevronDown, ChevronLeft, ChevronRight, Trash2, Check, Settings2, Files } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
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
import { StatusIcon } from '@/components/status-icon'
import { DocumentListItem } from '@/components/document-list-item'
import {
  useDocuments,
  useDeleteDocument,
  useProcessDocument,
  useCreateBatch,
  useUpdateDocument,
  useActiveJobs,
  useCancelJob,
  useCancelBatch,
} from '@/lib/queries'
import { useJobEvents } from '@/lib/websocket'
import { useDebounce } from '@/lib/hooks'

interface DocumentQueueProps {
  documentTypeId: string
  documentTypeSlug: string
  selectedDocId?: string
  urlSearch?: string
  urlStatus?: string
  urlPage?: number
  onDocumentSelect: (docId: string) => void
  onSearchChange: (search: string) => void
  onStatusChange: (status: string) => void
  onPageChange: (page: number) => void
}

export function DocumentQueue({
  documentTypeId,
  documentTypeSlug,
  selectedDocId,
  urlSearch = '',
  urlStatus = 'all',
  urlPage = 1,
  onDocumentSelect,
  onSearchChange,
  onStatusChange,
  onPageChange,
}: DocumentQueueProps) {
  // ============================================
  // Internal State
  // ============================================
  const [searchInput, setSearchInput] = useState(urlSearch)
  const [checkedDocIds, setCheckedDocIds] = useState<Set<string>>(new Set())
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [activeJobsMap, setActiveJobsMap] = useState<Map<string, { jobId: string; batchId?: string }>>(new Map())
  const documentRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const processingDocIds = new Set(activeJobsMap.keys())
  const debouncedSearch = useDebounce(searchInput, 300)

  // ============================================
  // Queries & Mutations
  // ============================================
  const queryClient = useQueryClient()
  const { data: documentsData, refetch } = useDocuments(documentTypeId, {
    page: urlPage,
    status: urlStatus,
    search: urlSearch || undefined,
  })
  const { data: activeJobsData } = useActiveJobs(documentTypeId)

  const deleteDocument = useDeleteDocument()
  const processDocument = useProcessDocument()
  const createBatch = useCreateBatch()
  const updateDocument = useUpdateDocument()
  const cancelJob = useCancelJob()
  const cancelBatch = useCancelBatch()

  const documents = documentsData?.documents || []

  // ============================================
  // Effects
  // ============================================

  // Sync debounced search to parent
  useEffect(() => {
    if (debouncedSearch !== urlSearch) {
      onSearchChange(debouncedSearch)
    }
  }, [debouncedSearch, urlSearch, onSearchChange])

  // Update local input when URL changes (back/forward nav)
  useEffect(() => {
    setSearchInput(urlSearch)
  }, [urlSearch])

  // Initialize activeJobsMap from server on page load
  useEffect(() => {
    if (activeJobsData?.jobs) {
      setActiveJobsMap((prev) => {
        const next = new Map(prev)
        for (const job of activeJobsData.jobs as Array<{ id: string; documentId: string; batchId?: string }>) {
          if (!next.has(job.documentId)) {
            next.set(job.documentId, { jobId: job.id, batchId: job.batchId })
          }
        }
        return next.size !== prev.size ? next : prev
      })
    }
  }, [activeJobsData])

  // Track processing state from WebSocket events
  useJobEvents(
    useCallback((event) => {
      if (!event.documentId) return

      if (event.type === 'job:started' && event.jobId) {
        setActiveJobsMap((prev) => {
          const next = new Map(prev)
          next.set(event.documentId!, { jobId: event.jobId!, batchId: event.batchId })
          return next
        })
      } else if (event.type === 'job:completed' || event.type === 'job:failed') {
        setActiveJobsMap((prev) => {
          const next = new Map(prev)
          next.delete(event.documentId!)
          return next
        })
      }
    }, []),
    [documentTypeId]
  )

  // Scroll to selected document
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
    if (!selectedDocId && documents.length > 0) {
      onDocumentSelect(documents[0].id)
    }
  }, [selectedDocId, documents, onDocumentSelect])

  // ============================================
  // Handlers
  // ============================================

  const handleFileUpload = useCallback(
    async (files: FileList) => {
      setIsUploading(true)
      const formData = new FormData()
      for (const file of files) {
        formData.append('files', file)
      }
      try {
        const res = await fetch(`/api/document-types/${documentTypeSlug}/upload`, {
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
    [documentTypeSlug, refetch]
  )

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
    if (checkedDocIds.size === 0) return

    const idsToProcess = Array.from(checkedDocIds)

    // Immediately mark as processing (placeholder job IDs)
    setActiveJobsMap((prev) => {
      const next = new Map(prev)
      for (const id of idsToProcess) {
        next.set(id, { jobId: `pending-${id}` })
      }
      return next
    })

    try {
      const result = await createBatch.mutateAsync({
        documentTypeId,
        documentIds: idsToProcess,
      })

      // Update with real batch ID
      if (result?.batchId) {
        setActiveJobsMap((prev) => {
          const next = new Map(prev)
          for (const id of idsToProcess) {
            const existing = next.get(id)
            if (existing) {
              next.set(id, { ...existing, batchId: result.batchId })
            }
          }
          return next
        })
      }

      setCheckedDocIds(new Set())
    } catch (error) {
      console.error('Batch processing failed:', error)
      // Revert optimistic update
      setActiveJobsMap((prev) => {
        const next = new Map(prev)
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
  }, [checkedDocIds, documentTypeId, createBatch, processDocument])

  const handleBulkApprove = useCallback(async () => {
    if (checkedDocIds.size === 0) return

    for (const id of checkedDocIds) {
      await updateDocument.mutateAsync({ id, data: { status: 'approved' } })
    }
    setCheckedDocIds(new Set())
  }, [checkedDocIds, updateDocument])

  const handleCancelAllProcessing = useCallback(async () => {
    const batchIds = new Set<string>()
    for (const job of activeJobsMap.values()) {
      if (job.batchId) batchIds.add(job.batchId)
    }

    for (const batchId of batchIds) {
      await cancelBatch.mutateAsync(batchId)
    }

    setActiveJobsMap(new Map())
  }, [activeJobsMap, cancelBatch])

  const handleCancelJob = useCallback(async (documentId: string) => {
    const job = activeJobsMap.get(documentId)
    if (!job) return

    await cancelJob.mutateAsync(job.jobId)

    setActiveJobsMap((prev) => {
      const next = new Map(prev)
      next.delete(documentId)
      return next
    })
  }, [activeJobsMap, cancelJob])

  // ============================================
  // Expose processing state for parent
  // ============================================

  // Check if a specific document is processing
  const isDocumentProcessing = useCallback((docId: string) => {
    return processingDocIds.has(docId)
  }, [processingDocIds])

  // ============================================
  // Render
  // ============================================

  return (
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
            if (value) onStatusChange(value)
          }}
          size="sm"
          className="w-full"
        >
          <ToggleGroupItem value="all" className="flex-1" aria-label="All documents">
            <Files className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="pending" className="flex-1" aria-label="Pending">
            <StatusIcon status="pending" size={14} />
          </ToggleGroupItem>
          <ToggleGroupItem value="processed" className="flex-1" aria-label="Processed">
            <StatusIcon status="processed" size={14} />
          </ToggleGroupItem>
          <ToggleGroupItem value="approved" className="flex-1" aria-label="Approved">
            <StatusIcon status="approved" size={14} />
          </ToggleGroupItem>
          <ToggleGroupItem value="rejected" className="flex-1" aria-label="Rejected">
            <StatusIcon status="rejected" size={14} />
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
          {/* Processing count with cancel on hover */}
          {(() => {
            const processingCount = documents.filter(d => processingDocIds.has(d.id)).length
            return processingCount > 0 ? (
              <button
                onClick={handleCancelAllProcessing}
                className="group flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Click to cancel all processing"
              >
                <Loader2 className="w-3 h-3 animate-spin group-hover:hidden" />
                <X className="w-3 h-3 hidden group-hover:block" />
                {processingCount}
              </button>
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
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleBulkProcess}>
              <Settings2 className="mr-2 h-4 w-4" />
              Process selected
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleBulkApprove}>
              <Check className="mr-2 h-4 w-4" />
              Approve selected
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleBulkDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
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
              onSelect={() => onDocumentSelect(doc.id)}
              onCheck={(checked) => handleToggleCheck(doc.id, checked)}
              onCancelJob={() => handleCancelJob(doc.id)}
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
          onClick={() => onPageChange(Math.max(1, urlPage - 1))}
          disabled={urlPage <= 1}
          className="px-2 py-1 rounded hover:bg-muted disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-muted-foreground">
          {urlPage} / {documentsData?.pagination?.totalPages || 1}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(urlPage + 1)}
          disabled={!documentsData?.pagination || urlPage >= documentsData.pagination.totalPages}
          className="px-2 py-1 rounded hover:bg-muted disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

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

// Export a hook to check if a document is processing (for parent components)
export function useDocumentProcessingState(documentTypeId: string) {
  const [activeJobsMap, setActiveJobsMap] = useState<Map<string, { jobId: string; batchId?: string }>>(new Map())
  const { data: activeJobsData } = useActiveJobs(documentTypeId)

  // Initialize from server
  useEffect(() => {
    if (activeJobsData?.jobs) {
      setActiveJobsMap((prev) => {
        const next = new Map(prev)
        for (const job of activeJobsData.jobs as Array<{ id: string; documentId: string; batchId?: string }>) {
          if (!next.has(job.documentId)) {
            next.set(job.documentId, { jobId: job.id, batchId: job.batchId })
          }
        }
        return next.size !== prev.size ? next : prev
      })
    }
  }, [activeJobsData])

  // Track from WebSocket
  useJobEvents(
    useCallback((event) => {
      if (!event.documentId) return

      if (event.type === 'job:started' && event.jobId) {
        setActiveJobsMap((prev) => {
          const next = new Map(prev)
          next.set(event.documentId!, { jobId: event.jobId!, batchId: event.batchId })
          return next
        })
      } else if (event.type === 'job:completed' || event.type === 'job:failed') {
        setActiveJobsMap((prev) => {
          const next = new Map(prev)
          next.delete(event.documentId!)
          return next
        })
      }
    }, []),
    [documentTypeId]
  )

  const isProcessing = useCallback((docId: string) => activeJobsMap.has(docId), [activeJobsMap])
  const processingDocIds = new Set(activeJobsMap.keys())

  return { isProcessing, processingDocIds, activeJobsMap }
}
