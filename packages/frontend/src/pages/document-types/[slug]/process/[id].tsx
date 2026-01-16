import { useNavigate, useParams } from '@tanstack/react-router'
import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ButtonGroup } from '@/components/ui/button-group'
import { Kbd } from '@/components/ui/kbd'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
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
  useProcessDocumentStreaming,
  useUpdateDocument,
} from '@/lib/queries'
import { useSession } from '@/lib/auth'
import { FormRenderer } from '@/components/form-renderer'
import { ModelSelector } from '@/components/model-selector'
import type { JsonSchema } from '@/components/schema-builder/types'

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

export default function DocumentEditorPage() {
  const params = useParams({ strict: false })
  const slug = params.slug as string
  const documentId = params.id as string
  const navigate = useNavigate()

  const [editedData, setEditedData] = useState<Record<string, unknown>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [modelOverride, setModelOverride] = useState('')
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingDocId, setPendingDocId] = useState<string | null>(null)
  const abortStreamRef = useRef<(() => void) | null>(null)

  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  const { data: docType } = useDocumentType(slug)
  const { data: currentDoc } = useDocument(documentId)
  const { data: documentsData } = useDocuments(docType?.id || '', { status: 'all' })
  const { processWithStreaming, abort: abortStreaming } = useProcessDocumentStreaming()
  const updateDocument = useUpdateDocument()

  const filteredDocs = documentsData?.documents || []

  // Get schema for form rendering
  const schema = (currentDoc?.schemaSnapshot || docType?.schema || {}) as JsonSchema

  // Update edited data when document changes
  const docExtractedData = currentDoc?.extractedData as Record<string, unknown> | null
  if (currentDoc && !hasChanges && !isStreaming && JSON.stringify(editedData) !== JSON.stringify(docExtractedData || {})) {
    setEditedData(docExtractedData || {})
  }

  const handleProcess = async () => {
    if (!currentDoc) return

    setIsStreaming(true)
    setEditedData({})
    setHasChanges(false)
    abortStreamRef.current = abortStreaming

    try {
      await processWithStreaming(
        currentDoc.id,
        modelOverride || undefined,
        (partialData) => {
          setEditedData({ ...partialData })
        },
        (completeData) => {
          setEditedData({ ...completeData })
          setHasChanges(false)
        },
        (error) => {
          console.error('Processing error:', error)
        },
      )
    } finally {
      setIsStreaming(false)
      abortStreamRef.current = null
    }
  }

  const handleStop = () => {
    abortStreamRef.current?.()
    setIsStreaming(false)
    abortStreamRef.current = null
  }

  const handleForceProcess = () => {
    handleProcess()
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
    if (currentIdx < filteredDocs.length - 1 && docType?.slug) {
      navigate({
        to: '/document-types/$slug/process/$id',
        params: { slug: docType.slug, id: filteredDocs[currentIdx + 1].id },
      })
    }
  }

  const handleReject = async () => {
    if (!currentDoc) return
    await updateDocument.mutateAsync({
      id: currentDoc.id,
      data: { status: 'rejected' },
    })
    // Move to next document
    const currentIdx = filteredDocs.findIndex((d) => d.id === currentDoc.id)
    if (currentIdx < filteredDocs.length - 1 && docType?.slug) {
      navigate({
        to: '/document-types/$slug/process/$id',
        params: { slug: docType.slug, id: filteredDocs[currentIdx + 1].id },
      })
    }
  }

  const handleUnapprove = async () => {
    if (!currentDoc) return
    await updateDocument.mutateAsync({
      id: currentDoc.id,
      data: { status: 'processed' },
    })
  }

  const handleClear = () => {
    if (!currentDoc) return
    setEditedData({})
    setHasChanges(true)
  }

  const navigateDocument = useCallback((direction: 'next' | 'prev') => {
    const currentIdx = filteredDocs.findIndex((d) => d.id === currentDoc?.id)
    const nextIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1
    if (nextIdx < 0 || nextIdx >= filteredDocs.length) return

    const nextDocId = filteredDocs[nextIdx].id

    if (hasChanges) {
      setPendingDocId(nextDocId)
      setShowUnsavedDialog(true)
    } else if (docType?.slug) {
      navigate({
        to: '/document-types/$slug/process/$id',
        params: { slug: docType.slug, id: nextDocId },
      })
    }
  }, [filteredDocs, currentDoc?.id, hasChanges, docType?.slug, navigate])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      const isPending = updateDocument.isPending || isStreaming

      // Ctrl+S - Save (works in inputs)
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        if (!isPending && hasChanges) handleSave()
      }
      // Ctrl+Enter - Approve (works in inputs)
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        if (!isPending && currentDoc) handleApprove()
      }
      // Ctrl+P - Process (not in inputs)
      if (e.ctrlKey && e.key === 'p' && !isInput) {
        e.preventDefault()
        if (!isPending && currentDoc) handleProcess()
      }
      // Ctrl+R - Reject (not in inputs)
      if (e.ctrlKey && e.key === 'r' && !isInput) {
        e.preventDefault()
        if (!isPending && currentDoc) handleReject()
      }
      // Ctrl+Down - Next document (not in inputs)
      if (e.ctrlKey && e.key === 'ArrowDown' && !isInput) {
        e.preventDefault()
        navigateDocument('next')
      }
      // Ctrl+Up - Previous document (not in inputs)
      if (e.ctrlKey && e.key === 'ArrowUp' && !isInput) {
        e.preventDefault()
        navigateDocument('prev')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  if (!currentDoc) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Document action header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground truncate max-w-[300px]" title={currentDoc.filename}>
            {currentDoc.slug || currentDoc.filename}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Model selector - admin only */}
          {isAdmin && (
            <div className="w-64">
              <ModelSelector
                value={modelOverride || docType?.modelName || ''}
                onChange={setModelOverride}
                placeholder={docType?.modelName || 'Default model'}
              />
            </div>
          )}

          {/* Process/Stop ButtonGroup */}
          {isStreaming ? (
            <Button variant="outline" onClick={handleStop}>
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
              <Button variant="outline" onClick={handleProcess} disabled={!currentDoc}>
                Process
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" disabled={!currentDoc}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleForceProcess}>
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
                onClick={handleUnapprove}
                disabled={!currentDoc || updateDocument.isPending}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <path d="M3 7v6h6" />
                  <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                </svg>
                Unapprove
              </Button>
            ) : (
              <Button
                onClick={handleApprove}
                disabled={!currentDoc || updateDocument.isPending || isStreaming}
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
                  disabled={!currentDoc || updateDocument.isPending}
                  className={currentDoc.status === 'approved' ? '' : 'bg-green-600 hover:bg-green-700 text-white'}
                  variant={currentDoc.status === 'approved' ? 'secondary' : 'default'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleSave} disabled={!hasChanges}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                    <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
                    <path d="M7 3v4a1 1 0 0 0 1 1h7" />
                  </svg>
                  Save
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleReject}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m15 9-6 6" />
                    <path d="m9 9 6 6" />
                  </svg>
                  Reject
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleClear}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M8 16H3v5" />
                  </svg>
                  Clear
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>

          {/* Keyboard Help Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" title="Keyboard shortcuts">
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
                <div className="flex justify-between"><span className="text-muted-foreground">Save</span> <span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd>+<Kbd>S</Kbd></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Approve</span> <span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Process</span> <span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd>+<Kbd>P</Kbd></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Reject</span> <span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd>+<Kbd>R</Kbd></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Next doc</span> <span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd>+<Kbd>↓</Kbd></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Prev doc</span> <span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd>+<Kbd>↑</Kbd></span></div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Form + Preview */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Form editor */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full overflow-y-auto p-6 bg-background">
            <div className="max-w-2xl space-y-6">
              {/* Streaming indicator */}
              {isStreaming && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span>Extracting data...</span>
                </div>
              )}

              {/* Form fields */}
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
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Document preview */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <DocumentPreview documentId={currentDoc.id} filename={currentDoc.filename} />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Unsaved changes dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Do you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDocId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingDocId && docType?.slug) {
                setHasChanges(false)
                navigate({
                  to: '/document-types/$slug/process/$id',
                  params: { slug: docType.slug, id: pendingDocId },
                })
              }
              setPendingDocId(null)
              setShowUnsavedDialog(false)
            }}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
