import { useNavigate, useParams } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
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
  useUpdateDocument,
  useRotateDocument,
} from '@/lib/queries'
import { FormRenderer } from '@/components/form-renderer'
import { DocumentViewer } from '@/components/document-viewer'
import { useDocumentEditorContext } from '@/lib/document-editor-context'
import type { JsonSchema } from '@/components/schema-builder/types'

export default function DocumentEditorPage() {
  const params = useParams({ strict: false })
  const slug = params.slug as string
  const documentId = params.id as string
  const navigate = useNavigate()

  const [editedData, setEditedData] = useState<Record<string, unknown>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingDocId, setPendingDocId] = useState<string | null>(null)

  // Get streaming state from parent context
  const { streamingData, isStreaming, registerSave, setHasUnsavedChanges } = useDocumentEditorContext()

  const { data: docType } = useDocumentType(slug)
  const { data: currentDoc } = useDocument(documentId)
  const { data: documentsData } = useDocuments(docType?.id || '', { status: 'all' })
  const updateDocument = useUpdateDocument()
  const rotateDocument = useRotateDocument()

  const filteredDocs = documentsData?.documents || []

  // Get schema for form rendering
  const schema = (currentDoc?.schemaSnapshot || docType?.schema || {}) as JsonSchema

  // Use streaming data when available, otherwise use document's extracted data
  const displayData = isStreaming && streamingData
    ? streamingData
    : (currentDoc?.extractedData as Record<string, unknown> | null) || {}

  // Update edited data when document changes or streaming completes
  useEffect(() => {
    if (!isStreaming) {
      const docData = (currentDoc?.extractedData as Record<string, unknown> | null) || {}
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

  const handleRotate = useCallback(async (degrees: number) => {
    if (!currentDoc) return
    await rotateDocument.mutateAsync({
      documentId: currentDoc.id,
      degrees,
    })
  }, [currentDoc, rotateDocument])

  // Navigation between documents
  const navigateDocument = useCallback((direction: 'prev' | 'next') => {
    if (!currentDoc || filteredDocs.length === 0) return

    const currentIdx = filteredDocs.findIndex(d => d.id === currentDoc.id)
    if (currentIdx === -1) return

    const nextIdx = direction === 'next'
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
        search: (prev) => prev,
      })
    }
  }, [filteredDocs, currentDoc?.id, hasChanges, docType?.slug, navigate])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // Ctrl+S - Save (works in inputs)
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        if (!updateDocument.isPending && hasChanges) handleSave()
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
                data={isStreaming ? displayData : editedData}
                onChange={(newData) => {
                  if (!isStreaming) {
                    setEditedData(newData)
                    setHasChanges(true)
                  }
                }}
                isStreaming={isStreaming}
              />

              {/* Save button if there are changes */}
              {hasChanges && !isStreaming && (
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
            <AlertDialogAction onClick={() => {
              if (pendingDocId && docType?.slug) {
                setHasChanges(false)
                navigate({
                  to: '/document-types/$slug/process/$id',
                  params: { slug: docType.slug, id: pendingDocId },
                  search: (prev) => prev,
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
