'use client'

import type React from 'react'
import { useState, useRef, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { UploadCloud, Loader2, Trash2, Bot, Square, Clock } from 'lucide-react'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { createDocument } from '@/lib/actions/document'
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

interface DocumentQueueProps {
  documentTypeId: string
  documents: Document[]
  selectedDocument: Document | null
  processingDocuments?: Set<string>
  currentlyProcessing?: string | null
  processingQueue?: string[]
  batchQueue?: string[]
  isBatchProcessing?: boolean
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
  onSelect,
  onUploadSuccess,
  onDelete,
  onProcessAll,
  onStopAll,
}: DocumentQueueProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string[]>(['pending', 'processed'])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isPending, startTransition] = useTransition()

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

  const filteredDocuments = documents.filter((doc) => {
    return statusFilter.includes(doc.status || 'pending')
  })

  return (
    <div
      className="bg-muted/20 relative flex h-full flex-col"
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
      <div className="border-border space-y-4 border-b p-4">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,application/pdf"
          multiple
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="h-4 w-4" />
          )}
          Upload
        </Button>
        {isBatchProcessing ? (
          <Button
            onClick={onStopAll}
            className="w-full"
            variant="outline"
          >
            <Square className="h-4 w-4" />
            Stop All
          </Button>
        ) : (
          <Button
            onClick={() => onProcessAll(filteredDocuments.map(d => d.id))}
            className="w-full"
            variant="outline"
            disabled={filteredDocuments.length === 0}
          >
            <Bot className="h-4 w-4" />
            Process All ({filteredDocuments.length})
          </Button>
        )}
        <ToggleGroup
          type="multiple"
          value={statusFilter}
          onValueChange={setStatusFilter}
          className="w-full"
        >
          <ToggleGroupItem
            value="pending"
            className={cn('gap-0.5 text-xs outline-2 outline-current', {
              'bg-secondary font-bold': statusFilter.includes('pending'),
            })}
          >
            <PendingStatusIcon size="sm" />
            <span className="truncate">Pending</span>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="processed"
            className={cn('gap-0.5 text-xs outline-2 outline-current', {
              'bg-secondary font-bold': statusFilter.includes('processed'),
            })}
          >
            <ProcessedStatusIcon size="sm" />
            <span className="truncate">Processed</span>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="approved"
            className={cn('gap-0.5 text-xs outline-2 outline-current', {
              'bg-secondary font-bold': statusFilter.includes('approved'),
            })}
          >
            <ApprovedStatusIcon size="sm" />
            <span className="truncate">Approved</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex-grow overflow-y-auto">
        {filteredDocuments.length === 0 ? (
          <div className="text-muted-foreground p-4 text-center text-sm">
            {documents.length > 0
              ? 'All documents are hidden by the filter.'
              : 'No documents uploaded yet.'}
          </div>
        ) : (
          <ul className="divide-border divide-y">
            {filteredDocuments.map((doc) => (
              <li
                key={doc.id}
                className={cn(
                  'hover:bg-muted group flex items-center justify-between pr-2',
                  selectedDocument?.id === doc.id && 'bg-muted',
                )}
              >
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
                        formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })
                      ) : (
                        'Unknown'
                      )}
                    </p>
                  </div>
                </div>
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
