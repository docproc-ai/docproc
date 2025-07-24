'use client'

import type React from 'react'
import { useState, useRef, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import type { DocumentSelect as Document } from '@/db/schema/app'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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
  onSelect: (doc: Document) => void
  onUploadSuccess: () => void
  onDelete: (docId: number) => void
}

export function DocumentQueue({
  documentTypeId,
  documents,
  selectedDocument,
  onSelect,
  onUploadSuccess,
  onDelete,
}: DocumentQueueProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [hideApproved, setHideApproved] = useState(true)
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

  const StatusIcon = ({ status }: { status: Document['approvalStatus'] }) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'rejected':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'pending':
      default:
        return <FileText className="text-muted-foreground h-4 w-4" />
    }
  }

  const filteredDocuments = documents.filter((doc) => {
    if (hideApproved && doc.approvalStatus === 'approved') {
      return false
    }
    return true
  })

  return (
    <div
      className="border-border bg-muted/20 relative flex h-full flex-col border-r"
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
        <div className="flex items-center space-x-2">
          <Checkbox
            id="hide-approved"
            checked={hideApproved}
            onCheckedChange={(checked) => setHideApproved(Boolean(checked))}
          />
          <Label htmlFor="hide-approved" className="cursor-pointer text-sm font-medium">
            Hide approved
          </Label>
        </div>
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
                  <StatusIcon status={doc.approvalStatus} />
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium">{doc.filename}</p>
                    <p className="text-muted-foreground text-xs">
                      {doc.createdAt ? formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true }) : 'Unknown'}
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
                        This will permanently delete the document "{doc.filename}" and its
                        data. This action cannot be undone.
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
