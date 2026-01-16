import {
  ChevronLeft,
  ChevronRight,
  File,
  FileCheck,
  FileJson,
  Files,
  FileX,
  Loader2,
  type LucideIcon,
  MoreHorizontal,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DocumentListItem } from '@/components/document-list-item'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useDebounce } from '@/lib/hooks'
import {
  useActiveJobs,
  useCancelBatch,
  useCancelJob,
  useCreateBatch,
  useDeleteDocument,
  useDocuments,
  useProcessDocument,
  useUpdateDocument,
} from '@/lib/queries'
import { useJobEvents } from '@/lib/websocket'

// Status icon config
const statusConfig: Record<string, { icon: LucideIcon; className: string; title: string }> = {
  pending: { icon: File, className: 'text-muted-foreground', title: 'Pending' },
  processing: { icon: Loader2, className: 'text-blue-500 animate-spin', title: 'Processing' },
  processed: { icon: FileJson, className: 'text-blue-500', title: 'Processed' },
  approved: { icon: FileCheck, className: 'text-green-500', title: 'Approved' },
  rejected: { icon: FileX, className: 'text-red-500', title: 'Rejected' },
}

function StatusIcon({ status, size = 16 }: { status: string; size?: number }) {
  const config = statusConfig[status] || statusConfig.pending
  const Icon = config.icon
  return (
    <span className="shrink-0" title={config.title}>
      <Icon size={size} className={config.className} />
    </span>
  )
}

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
  const [isDragOver, setIsDragOver] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [activeJobsMap, setActiveJobsMap] = useState<Map<string, { jobId: string; batchId?: string }>>(new Map())
  const documentRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const processingDocIds = new Set(activeJobsMap.keys())
  const debouncedSearch = useDebounce(searchInput, 300)

  // ============================================
  // Queries & Mutations
  // ============================================
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

  const handleBulkSetStatus = useCallback(async (status: 'pending' | 'processed' | 'approved' | 'rejected') => {
    if (checkedDocIds.size === 0) return

    for (const id of checkedDocIds) {
      await updateDocument.mutateAsync({ id, data: { status } })
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
  // Render
  // ============================================

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Status filter */}
      <div className="p-3 border-b">
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

      {/* Search bar with checkbox and actions */}
      <div className="px-3 py-2 border-b flex items-center gap-2">
        <Checkbox
          checked={checkedDocIds.size === documents.length && documents.length > 0}
          onCheckedChange={() => handleSelectAll()}
        />
        {checkedDocIds.size > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">{checkedDocIds.size}</span>
        )}
        <Input
          placeholder="Search documents..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-8 flex-1"
        />
        {/* Processing indicator */}
        {(() => {
          const processingCount = documents.filter(d => processingDocIds.has(d.id)).length
          return processingCount > 0 ? (
            <button
              type="button"
              onClick={handleCancelAllProcessing}
              className="group flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Click to cancel all processing"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin group-hover:hidden" />
              <X className="w-3.5 h-3.5 hidden group-hover:block" />
            </button>
          ) : null
        })()}
        {/* Actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {checkedDocIds.size > 0 && (
              <>
                <div className="px-2 py-1.5 text-sm font-medium">
                  {checkedDocIds.size} selected
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={handleBulkProcess} disabled={checkedDocIds.size === 0}>
              <Settings2 className="mr-2 h-4 w-4" />
              Process
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleBulkSetStatus('pending')} disabled={checkedDocIds.size === 0}>
              <File className="mr-2 h-4 w-4 text-muted-foreground" />
              Mark as Pending
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleBulkSetStatus('processed')} disabled={checkedDocIds.size === 0}>
              <FileJson className="mr-2 h-4 w-4 text-blue-500" />
              Mark as Processed
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleBulkSetStatus('approved')} disabled={checkedDocIds.size === 0}>
              <FileCheck className="mr-2 h-4 w-4 text-green-500" />
              Mark as Approved
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleBulkSetStatus('rejected')} disabled={checkedDocIds.size === 0}>
              <FileX className="mr-2 h-4 w-4 text-red-500" />
              Mark as Rejected
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleBulkDelete}
              disabled={checkedDocIds.size === 0}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
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
        {documents.length === 0 ? null : (
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
