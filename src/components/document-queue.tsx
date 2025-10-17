'use client'

import type React from 'react'
import { useState, useRef, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { UploadCloud, Loader2, Trash2, Bot, Square, Clock, MoreHorizontal, CircleDashed, CheckCircle2, BadgeCheck, Search, Filter } from 'lucide-react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  DocumentStatusIcon,
  PendingStatusIcon,
  ProcessedStatusIcon,
  ApprovedStatusIcon,
} from '@/components/document-status-icon'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import type { DocumentSelect as Document } from '@/db/schema/app'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import { createDocument, bulkUpdateDocumentStatus } from '@/lib/actions/document'

// Client-only date formatter to avoid hydration issues
function ClientDate({ date }: { date: Date | null }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !date) {
    return <span>Loading...</span>
  }

  return <span>{formatDistanceToNow(new Date(date), { addSuffix: true })}</span>
}
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface DocumentQueueProps {
  documentTypeId: string
  documents: Document[]
  selectedDocument: Document | null
  processingDocuments?: Set<string>
  currentlyProcessing?: string | null
  processingQueue?: string[]
  batchQueue?: string[]
  isBatchProcessing?: boolean
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  onSelect: (doc: Document) => void
  onUploadSuccess: () => void
  onDelete: (docId: string) => void
  onProcessAll: (docIds: string[]) => void
  onStopAll?: () => void
}

export function DocumentQueue({
  documentTypeId,
  documents,
  selectedDocument,
  processingDocuments = new Set(),
  currentlyProcessing,
  processingQueue = [],
  batchQueue = [],
  isBatchProcessing = false,
  pagination = { page: 1, pageSize: 50, total: 0, totalPages: 0 },
  onSelect,
  onUploadSuccess,
  onDelete,
  onProcessAll,
  onStopAll,
}: DocumentQueueProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isUploading, setIsUploading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<Set<string>>(() => {
    const status = searchParams.get('status')
    if (!status || status === 'all') {
      return new Set(['pending', 'processed', 'approved'])
    }
    // Handle comma-separated values
    return new Set(status.split(','))
  })
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [isDragging, setIsDragging] = useState(false)
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isPending, startTransition] = useTransition()

  // Update URL params
  const updateUrlParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })

    const queryString = params.toString()
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname

    startTransition(() => {
      router.push(newUrl, { scroll: false })
      router.refresh()
    })
  }

  // Handle status filter changes
  const handleStatusToggle = (status: string) => {
    const newFilter = new Set(statusFilter)
    if (newFilter.has(status)) {
      newFilter.delete(status)
    } else {
      newFilter.add(status)
    }

    setStatusFilter(newFilter)

    // Convert to array and pass to backend
    const statusArray = Array.from(newFilter)
    const statusValue = statusArray.length === 0 ? 'all' : statusArray.join(',')
    updateUrlParams({ status: statusValue, page: '1' })
  }

  // Handle search changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    // Update URL immediately when search changes (including when cleared)
    updateUrlParams({ search: value || null, page: '1' })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Already handled by onChange, but keep this for explicit Enter key support
  }

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    updateUrlParams({ page: newPage.toString() })
  }

  const handleFilesUpload = async (files: File[]) => {
    if (!files || files.length === 0) return

    setIsUploading(true)
    startTransition(async () => {
      try {
        for (const file of files) {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('documentTypeId', documentTypeId)

          await createDocument(formData)
        }
        toast.success(`${files.length} document(s) uploaded.`)
        onUploadSuccess()
      } catch (error: any) {
        toast.error(`Upload Error: ${error.message}`)
      } finally {
        setIsUploading(false)
      }
    })
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      handleFilesUpload(Array.from(files))
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(Array.from(e.dataTransfer.files))
    }
  }

  // Documents are already filtered by the server based on URL params
  const filteredDocuments = documents

  // Multi-select handlers
  const handleToggleSelect = (docId: string) => {
    setSelectedDocIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(docId)) {
        newSet.delete(docId)
      } else {
        newSet.add(docId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    setSelectedDocIds(new Set(filteredDocuments.map((d) => d.id)))
  }

  const handleClearSelection = () => {
    setSelectedDocIds(new Set())
  }

  const handleBulkDelete = async () => {
    if (selectedDocIds.size === 0) return

    const count = selectedDocIds.size
    startTransition(async () => {
      try {
        // Delete all selected documents
        for (const docId of selectedDocIds) {
          await onDelete(docId)
        }
        toast.success(`${count} document(s) deleted.`)
        setSelectedDocIds(new Set())
      } catch (error: any) {
        toast.error(`Bulk Delete Error: ${error.message}`)
      }
    })
  }

  const handleProcessSelected = () => {
    if (selectedDocIds.size === 0) return
    onProcessAll(Array.from(selectedDocIds))
    setSelectedDocIds(new Set())
  }

  const handleBulkStatusUpdate = async (status: 'pending' | 'processed' | 'approved') => {
    if (selectedDocIds.size === 0) return

    const count = selectedDocIds.size
    startTransition(async () => {
      try {
        await bulkUpdateDocumentStatus(Array.from(selectedDocIds), status)
        toast.success(`${count} document(s) marked as ${status}.`)
        setSelectedDocIds(new Set())
        onUploadSuccess() // Refresh the document list
      } catch (error: any) {
        toast.error(`Bulk Status Update Error: ${error.message}`)
      }
    })
  }

  return (
    <div
      className="@container bg-muted/20 relative flex h-full flex-col"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="bg-background/80 border-primary pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg border-2 border-dashed">
          <UploadCloud className="text-primary h-16 w-16" />
          <p className="text-primary mt-4 text-lg font-semibold">Drop files to upload</p>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,application/pdf"
        multiple
      />
      <div className="border-border space-y-2 border-b p-4">
        <ButtonGroup className="w-full">
          <Button
            variant={statusFilter.has('pending') ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleStatusToggle('pending')}
            className="flex-1 gap-0.5 text-xs"
          >
            <PendingStatusIcon size="sm" />
            <span className="truncate">Pending</span>
          </Button>
          <Button
            variant={statusFilter.has('processed') ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleStatusToggle('processed')}
            className="flex-1 gap-0.5 text-xs"
          >
            <ProcessedStatusIcon size="sm" />
            <span className="truncate">Processed</span>
          </Button>
          <Button
            variant={statusFilter.has('approved') ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleStatusToggle('approved')}
            className="flex-1 gap-0.5 text-xs"
          >
            <ApprovedStatusIcon size="sm" />
            <span className="truncate">Approved</span>
          </Button>
        </ButtonGroup>
      </div>
      <div className="flex-grow overflow-y-auto">
        {/* Table header with search and selection - always visible */}
        <div className="border-border sticky top-0 z-10 flex items-center gap-2 border-b bg-background p-2">
          <Checkbox
            checked={selectedDocIds.size === filteredDocuments.length && filteredDocuments.length > 0}
            onCheckedChange={(checked) => {
              if (checked) {
                handleSelectAll()
              } else {
                handleClearSelection()
              }
            }}
          />
          <form onSubmit={handleSearchSubmit} className="flex-1">
            <InputGroup>
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={handleSearchChange}
              />
            </InputGroup>
          </form>
          <div className="flex items-center gap-2">
                {selectedDocIds.size > 0 && (
                  <span className="text-muted-foreground text-xs">
                    {selectedDocIds.size}
                  </span>
                )}
                <ButtonGroup>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    title="Upload documents"
                  >
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  </Button>
                  {isBatchProcessing ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onStopAll}
                      title="Stop processing"
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedDocIds.size > 0) {
                          handleProcessSelected()
                        } else {
                          onProcessAll(filteredDocuments.map(d => d.id))
                        }
                      }}
                      disabled={isPending || filteredDocuments.length === 0}
                      title={selectedDocIds.size > 0 ? "Process selected documents" : "Process all documents"}
                    >
                      <Bot className="h-4 w-4" />
                    </Button>
                  )}
                  {selectedDocIds.size > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" title="More actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleBulkStatusUpdate('pending')}>
                          <CircleDashed className="mr-2 h-4 w-4" />
                          Mark as Pending
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusUpdate('processed')}>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Mark as Processed
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusUpdate('approved')}>
                          <BadgeCheck className="mr-2 h-4 w-4" />
                          Mark as Approved
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <Trash2 className="text-destructive mr-2 h-4 w-4" />
                              Delete {selectedDocIds.size} document{selectedDocIds.size > 1 ? 's' : ''}
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {selectedDocIds.size} documents?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete {selectedDocIds.size} document(s) and their data.
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleBulkDelete}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete All
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </ButtonGroup>
              </div>
            </div>
        {filteredDocuments.length === 0 ? (
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Filter />
              </EmptyMedia>
              <EmptyTitle>No matching documents</EmptyTitle>
              <EmptyDescription>
                {pagination.totalPages === 0
                  ? `No documents found with status: ${Array.from(statusFilter).join(', ')}.`
                  : 'Try adjusting your filters or search to find documents.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-border divide-y">
            {filteredDocuments.map((doc) => (
              <li
                key={doc.id}
                className={cn(
                  'hover:bg-muted group flex items-center justify-between pr-2',
                  selectedDocument?.id === doc.id && 'bg-muted',
                  selectedDocIds.has(doc.id) && 'bg-blue-50 dark:bg-blue-950',
                )}
              >
                <div className="flex items-center gap-2 pl-2">
                  <Checkbox
                    checked={selectedDocIds.has(doc.id)}
                    onCheckedChange={() => handleToggleSelect(doc.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div
                  onClick={() => onSelect(doc)}
                  className="flex flex-1 cursor-pointer items-center gap-3 overflow-hidden p-4"
                >
                  {processingDocuments.has(doc.id) ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  ) : batchQueue.includes(doc.id) || processingQueue?.includes(doc.id) ? (
                    <Clock className="h-4 w-4 text-orange-500" />
                  ) : (
                    <DocumentStatusIcon status={doc.status} />
                  )}
                  <div className="flex-1 overflow-hidden">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{doc.filename}</span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {currentlyProcessing === doc.id ? (
                        <span className="text-blue-600 font-medium">Processing now...</span>
                      ) : processingQueue.includes(doc.id) ? (
                        <span className="text-orange-600 font-medium">
                          Queued ({processingQueue.indexOf(doc.id) + 1})
                        </span>
                      ) : doc.createdAt ? (
                        <ClientDate date={doc.createdAt} />
                      ) : (
                        'Unknown'
                      )}
                    </p>
                  </div>
                </div>
                {!selectedDocIds.has(doc.id) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Trash2 className="text-destructive h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the document "{doc.filename}" and its data.
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDelete(doc.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {pagination.totalPages > 1 && (
        <div className="border-border border-t p-2 @sm:p-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (pagination.page > 1) handlePageChange(pagination.page - 1)
                  }}
                  className={cn(
                    pagination.page <= 1 && 'pointer-events-none opacity-50'
                  )}
                />
              </PaginationItem>

              {/* Always show exactly 5 items (or all if less than 5 total) */}
              {(() => {
                const pages = []
                const current = pagination.page
                const total = pagination.totalPages

                // Helper to add a page button
                const addPage = (pageNum: number) => {
                  pages.push(
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          handlePageChange(pageNum)
                        }}
                        isActive={current === pageNum}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  )
                }

                const addEllipsis = (key: string) => {
                  pages.push(
                    <PaginationItem key={key}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )
                }

                if (total <= 5) {
                  // Show all pages if 5 or fewer (no ellipsis needed)
                  for (let i = 1; i <= total; i++) {
                    addPage(i)
                  }
                } else {
                  // 6+ pages: Always show exactly 5 items

                  if (current <= 2) {
                    // Near start: 1 2 3 ... last
                    addPage(1)
                    addPage(2)
                    addPage(3)
                    addEllipsis('end')
                    addPage(total)
                  } else if (current >= total - 1) {
                    // Near end: 1 ... (total-2) (total-1) total
                    addPage(1)
                    addEllipsis('start')
                    addPage(total - 2)
                    addPage(total - 1)
                    addPage(total)
                  } else {
                    // Middle: 1 ... current ... last
                    addPage(1)
                    addEllipsis('start')
                    addPage(current)
                    addEllipsis('end')
                    addPage(total)
                  }
                }

                return pages
              })()}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (pagination.page < pagination.totalPages) handlePageChange(pagination.page + 1)
                  }}
                  className={cn(
                    pagination.page >= pagination.totalPages && 'pointer-events-none opacity-50'
                  )}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}
