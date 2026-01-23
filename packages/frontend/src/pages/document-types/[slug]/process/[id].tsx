import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { DocumentViewer } from '@/components/document-viewer'
import { DataEditorTab } from '@/components/editor-tabs'
import { FormRenderer } from '@/components/form-renderer'
import type { JsonSchema } from '@/components/schema-builder/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentEditorContext } from '@/lib/document-editor-context'
import {
  useDocument,
  useDocuments,
  useDocumentType,
  useRotateDocument,
  useUpdateDocument,
} from '@/lib/queries'

export default function DocumentEditorPage() {
  const params = useParams({ strict: false })
  const slug = params.slug as string
  const documentId = params.id as string
  const navigate = useNavigate()
  const { q: urlSearch, status: urlStatus, page: urlPage } = useSearch({
    from: '/document-types/$slug/process/$id',
  })

  const [editedData, setEditedData] = useState<Record<string, unknown>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingDocId, setPendingDocId] = useState<string | null>(null)

  // Get streaming state from parent context
  const { streamingData, isStreaming, registerSave, setHasUnsavedChanges } =
    useDocumentEditorContext()

  const { data: docType } = useDocumentType(slug)
  const { data: currentDoc } = useDocument(documentId)
  const { data: documentsData } = useDocuments(docType?.id || '', {
    status: 'all',
  })
  const updateDocument = useUpdateDocument()
  const rotateDocument = useRotateDocument()

  const filteredDocs = documentsData?.documents || []

  // Get schema for form rendering
  const schema = (currentDoc?.schemaSnapshot ||
    docType?.schema ||
    {}) as JsonSchema

  // Use streaming data when available, otherwise use document's extracted data
  const displayData =
    isStreaming && streamingData
      ? streamingData
      : (currentDoc?.extractedData as Record<string, unknown> | null) || {}

  // Update edited data when document changes or streaming completes
  useEffect(() => {
    if (!isStreaming) {
      const docData =
        (currentDoc?.extractedData as Record<string, unknown> | null) || {}
      setEditedData(docData)
      setHasChanges(false)
    }
  }, [currentDoc?.extractedData, isStreaming])

  // Sync streaming data to edited data
  useEffect(() => {
    if (streamingData) {
      setEditedData(streamingData)
    }
  }, [streamingData])

  const handleSave = useCallback(async () => {
    if (!currentDoc) return
    await updateDocument.mutateAsync({
      id: currentDoc.id,
      data: { extractedData: editedData },
    })
    setHasChanges(false)
  }, [currentDoc, editedData, updateDocument])

  // Register save function with parent context
  useEffect(() => {
    registerSave(handleSave)
    return () => registerSave(null)
  }, [handleSave, registerSave])

  // Sync hasChanges to parent context
  useEffect(() => {
    setHasUnsavedChanges(hasChanges)
  }, [hasChanges, setHasUnsavedChanges])

  const handleRotate = useCallback(
    async (degrees: number, pageNumber?: number) => {
      if (!currentDoc) return
      await rotateDocument.mutateAsync({
        documentId: currentDoc.id,
        degrees,
        pageNumber,
      })
    },
    [currentDoc, rotateDocument],
  )

  // Navigation between documents
  const navigateDocument = useCallback(
    (direction: 'prev' | 'next') => {
      if (!currentDoc || filteredDocs.length === 0) return

      const currentIdx = filteredDocs.findIndex((d) => d.id === currentDoc.id)
      if (currentIdx === -1) return

      const nextIdx =
        direction === 'next'
          ? (currentIdx + 1) % filteredDocs.length
          : (currentIdx - 1 + filteredDocs.length) % filteredDocs.length
      const nextDocId = filteredDocs[nextIdx].id

      if (hasChanges) {
        setPendingDocId(nextDocId)
        setShowUnsavedDialog(true)
      } else if (docType?.slug) {
        navigate({
          to: '/document-types/$slug/process/$id',
          params: { slug: docType.slug, id: nextDocId },
          search: { q: urlSearch, status: urlStatus, page: urlPage },
        })
      }
    },
    [
      filteredDocs,
      currentDoc?.id,
      hasChanges,
      docType?.slug,
      navigate,
      currentDoc,
      urlSearch,
      urlStatus,
      urlPage,
    ],
  )

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S - Save (works in inputs)
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        if (!updateDocument.isPending && hasChanges) handleSave()
      }
      // Ctrl+Down - Next document (works everywhere)
      if (e.ctrlKey && e.key === 'ArrowDown') {
        e.preventDefault()
        navigateDocument('next')
      }
      // Ctrl+Up - Previous document (works everywhere)
      if (e.ctrlKey && e.key === 'ArrowUp') {
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
      {/* Form + Preview */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Form editor */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col bg-background">
            <Tabs defaultValue="form" className="flex-1 min-h-0 flex flex-col p-4 pb-0 gap-4">
              <TabsList className="w-full shrink-0">
                <TabsTrigger value="form">Form</TabsTrigger>
                <TabsTrigger value="data">Data</TabsTrigger>
              </TabsList>

              <TabsContent value="form" className="flex-1 min-h-0 overflow-y-auto m-0 -mx-4 px-4">
                <div className="max-w-2xl space-y-6 pb-4">
                  {/* Rejection reason */}
                  {currentDoc.status === 'rejected' &&
                    currentDoc.rejectionReason && (
                      <Alert variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertTitle>Rejected</AlertTitle>
                        <AlertDescription>
                          {currentDoc.rejectionReason}
                        </AlertDescription>
                      </Alert>
                    )}

                  {/* Streaming indicator */}
                  {isStreaming && (
                    <Alert>
                      <Spinner />
                      <AlertDescription>Extracting data...</AlertDescription>
                    </Alert>
                  )}

                  {/* Form fields */}
                  <FormRenderer
                    schema={schema}
                    data={isStreaming ? displayData : editedData}
                    onChange={(newData) => {
                      if (!isStreaming) {
                        setEditedData(newData as Record<string, unknown>)
                        setHasChanges(true)
                      }
                    }}
                    isStreaming={isStreaming}
                  />
                </div>
              </TabsContent>

              <TabsContent value="data" className="flex-1 min-h-0 m-0 -mx-4 px-4 pb-4 overflow-hidden">
                <DataEditorTab
                  value={JSON.stringify(
                    isStreaming ? displayData : editedData,
                    null,
                    2,
                  )}
                  onChange={(value) => {
                    if (!isStreaming && value) {
                      try {
                        const parsed = JSON.parse(value)
                        setEditedData(parsed)
                        setHasChanges(true)
                      } catch {
                        // Invalid JSON, ignore
                      }
                    }
                  }}
                />
              </TabsContent>
            </Tabs>

            {/* Save bar - fixed at bottom */}
            {hasChanges && !isStreaming && (
              <div className="shrink-0 py-2 px-3 bg-muted/80 border-t flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  Unsaved changes
                </span>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={updateDocument.isPending}
                >
                  {updateDocument.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Document preview */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <DocumentViewer
            documentId={currentDoc.id}
            filename={currentDoc.filename}
            onRotate={handleRotate}
          />
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
            <AlertDialogAction
              onClick={() => {
                if (pendingDocId && docType?.slug) {
                  setHasChanges(false)
                  navigate({
                    to: '/document-types/$slug/process/$id',
                    params: { slug: docType.slug, id: pendingDocId },
                    search: { q: urlSearch, status: urlStatus, page: urlPage },
                  })
                }
                setPendingDocId(null)
                setShowUnsavedDialog(false)
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
