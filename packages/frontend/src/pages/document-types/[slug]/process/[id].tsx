import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { XCircle, Zap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DataEditorTab } from '@/components/editor-tabs'
import { FormRenderer } from '@/components/form-renderer'
import type { JsonSchema } from '@/components/schema-builder/types'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
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
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentEditorStore } from '@/lib/document-editor-store'
import {
  useDocument,
  useDocuments,
  useDocumentType,
  useUpdateDocument,
} from '@/lib/queries'

export default function DocumentEditorPage() {
  const params = useParams({ strict: false })
  const slug = params.slug as string
  const documentId = params.id as string
  const navigate = useNavigate()
  const {
    q: urlSearch,
    status: urlStatus,
    page: urlPage,
  } = useSearch({
    from: '/document-types/$slug/process/$id',
  })

  const [editedData, setEditedData] = useState<Record<string, unknown>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingDocId, setPendingDocId] = useState<string | null>(null)

  // Get streaming state from store
  const {
    streamingData,
    streamingDocId,
    isStreaming: isStoreStreaming,
    registerSave,
    setHasUnsavedChanges,
    processFn,
  } = useDocumentEditorStore()

  // Only show streaming state if it's for this document
  const isStreaming = isStoreStreaming && streamingDocId === documentId
  const activeStreamingData = isStreaming ? streamingData : null

  const { data: docType } = useDocumentType(slug)
  const { data: currentDoc } = useDocument(documentId)
  const { data: documentsData } = useDocuments(docType?.id || '', {
    status: 'all',
  })
  const updateDocument = useUpdateDocument()

  const filteredDocs = documentsData?.documents || []

  // Get schema for form rendering
  const schema = (currentDoc?.schemaSnapshot ||
    docType?.schema ||
    {}) as JsonSchema

  // Use streaming data when available, otherwise use document's extracted data
  const displayData =
    isStreaming && activeStreamingData
      ? activeStreamingData
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
    if (activeStreamingData) {
      setEditedData(activeStreamingData)
    }
  }, [activeStreamingData])

  // Use ref to avoid re-registering on every editedData change
  const saveRef = useRef<() => Promise<void>>()
  saveRef.current = async () => {
    if (!currentDoc) return
    await updateDocument.mutateAsync({
      id: currentDoc.id,
      data: { extractedData: editedData },
    })
    setHasChanges(false)
  }

  const handleSave = useCallback(async () => {
    await saveRef.current?.()
  }, [])

  // Register save function once on mount
  useEffect(() => {
    registerSave(handleSave)
    return () => registerSave(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync hasChanges to parent
  useEffect(() => {
    setHasUnsavedChanges(hasChanges)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChanges])

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
      <Tabs
        defaultValue="form"
        className="flex-1 min-h-0 flex flex-col gap-4 pt-4"
      >
        <div className="px-4">
          <TabsList className="w-full">
            <TabsTrigger value="form">Form</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="form"
          className="flex-1 min-h-0 m-0 overflow-y-auto overflow-x-hidden"
        >
          <div className="px-4 pb-4 space-y-6">
            {/* Rejection reason */}
            {currentDoc.status === 'rejected' && currentDoc.rejectionReason && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Rejected</AlertTitle>
                <AlertDescription>
                  {currentDoc.rejectionReason}
                </AlertDescription>
                <AlertAction>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => processFn?.(true)}
                    disabled={!processFn || isStreaming}
                  >
                    <Zap className="h-4 w-4" />
                    Force Process
                  </Button>
                </AlertAction>
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

        <TabsContent
          value="data"
          className="flex-1 min-h-0 m-0 px-4 pb-4 overflow-hidden"
        >
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
          <span className="text-sm text-muted-foreground">Unsaved changes</span>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateDocument.isPending}
          >
            {updateDocument.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}

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
