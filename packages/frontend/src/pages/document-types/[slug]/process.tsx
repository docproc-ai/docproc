import {
  Link,
  Outlet,
  useNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Keyboard,
  Save,
  Settings,
  Square,
  Trash2,
  Undo2,
  XCircle,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import {
  DocumentQueue,
  useDocumentProcessingState,
} from '@/components/document-queue'
import { ModelSelector } from '@/components/model-selector'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Kbd } from '@/components/ui/kbd'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useSession } from '@/lib/auth'
import { DocumentEditorProvider } from '@/lib/document-editor-context'
import {
  useCancelJob,
  useDocument,
  useDocumentType,
  useProcessDocumentStreaming,
  useUpdateDocument,
} from '@/lib/queries'
import { useDocumentTypeLiveUpdates } from '@/lib/websocket'

export default function ProcessLayout() {
  const params = useParams({ strict: false })
  const slug = params.slug as string
  const selectedDocId = params.id as string | undefined
  const navigate = useNavigate()

  // URL search params for shareable state
  const {
    q: urlSearch,
    status: urlStatus,
    page: urlPage,
  } = useSearch({
    from: '/document-types/$slug/process',
  })

  // Document action state (for header controls)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingDocId, setStreamingDocId] = useState<string | null>(null)
  const [streamingJobId, setStreamingJobId] = useState<string | null>(null)
  const [modelOverride, setModelOverride] = useState('')
  const [streamingData, setStreamingData] = useState<Record<
    string,
    unknown
  > | null>(null)
  const abortStreamRef = useRef<(() => void) | null>(null)

  // Editor context state (lifted from child)
  const [editorSaveFn, setEditorSaveFn] = useState<
    (() => Promise<void>) | null
  >(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const registerSave = useCallback((fn: (() => Promise<void>) | null) => {
    setEditorSaveFn(() => fn)
  }, [])

  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  const { data: docType, isLoading: typeLoading } = useDocumentType(slug)
  const { data: currentDoc } = useDocument(selectedDocId || '')

  const { processWithStreaming, abort: abortStreaming } =
    useProcessDocumentStreaming()
  const updateDocument = useUpdateDocument()

  // Track processing state for the selected document
  const { isProcessing: isDocProcessing, activeJobsMap } =
    useDocumentProcessingState(docType?.id || '')
  const cancelJob = useCancelJob()

  // WebSocket for live updates
  useDocumentTypeLiveUpdates(docType?.id)

  // ============================================
  // Navigation Handlers
  // ============================================

  const handleDocumentSelect = useCallback(
    (docId: string) => {
      if (docType?.slug) {
        navigate({
          to: '/document-types/$slug/process/$id',
          params: { slug: docType.slug, id: docId },
          search: (prev) => prev,
        })
      }
    },
    [docType?.slug, navigate],
  )

  const handleSearchChange = useCallback(
    (search: string) => {
      navigate({
        search: (prev) => ({ ...prev, q: search || undefined, page: 1 }),
        replace: true,
      })
    },
    [navigate],
  )

  const handleStatusChange = useCallback(
    (status: string) => {
      navigate({
        search: (prev) => ({ ...prev, status, page: 1 }),
        replace: true,
      })
    },
    [navigate],
  )

  const handlePageChange = useCallback(
    (page: number) => {
      navigate({
        search: (prev) => ({ ...prev, page }),
        replace: true,
      })
    },
    [navigate],
  )

  // ============================================
  // Document Action Handlers (Header Controls)
  // ============================================

  const handleProcess = useCallback(async () => {
    if (!currentDoc) return

    setIsStreaming(true)
    setStreamingDocId(currentDoc.id)
    setStreamingJobId(null)
    setStreamingData({})
    abortStreamRef.current = abortStreaming

    try {
      await processWithStreaming(
        currentDoc.id,
        modelOverride || undefined,
        (jobId) => setStreamingJobId(jobId),
        (partialData) => setStreamingData({ ...partialData }),
        (completeData) => setStreamingData({ ...completeData }),
        (error) => console.error('Processing error:', error),
      )
    } finally {
      setIsStreaming(false)
      setStreamingDocId(null)
      setStreamingJobId(null)
      abortStreamRef.current = null
    }
  }, [currentDoc, modelOverride, processWithStreaming, abortStreaming])

  const handleStop = useCallback(async () => {
    // Stop streaming if active
    if (abortStreamRef.current) {
      abortStreamRef.current()
      setIsStreaming(false)
      setStreamingDocId(null)
      abortStreamRef.current = null
    }
    // Cancel the streaming job if we have its ID
    if (streamingJobId) {
      await cancelJob.mutateAsync(streamingJobId)
      setStreamingJobId(null)
    }
    // Cancel batch job if active (for non-streaming jobs)
    if (selectedDocId && !streamingJobId) {
      const job = activeJobsMap.get(selectedDocId)
      if (job) {
        await cancelJob.mutateAsync(job.jobId)
      }
    }
  }, [selectedDocId, activeJobsMap, cancelJob, streamingJobId])

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

  const handleSaveFromHeader = useCallback(async () => {
    if (editorSaveFn) await editorSaveFn()
  }, [editorSaveFn])

  const handleClear = useCallback(async () => {
    if (!currentDoc) return
    await updateDocument.mutateAsync({
      id: currentDoc.id,
      data: { extractedData: {} },
    })
  }, [currentDoc, updateDocument])

  // ============================================
  // Render
  // ============================================

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

  // Check if current document is processing (either streaming or batch job)
  const isCurrentDocStreaming = isStreaming && streamingDocId === selectedDocId
  const isSelectedDocProcessing = selectedDocId
    ? isCurrentDocStreaming || isDocProcessing(selectedDocId)
    : false

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
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="font-semibold">{docType.name}</h1>
            <Link
              to="/document-types/$slug/settings"
              params={{ slug: docType.slug }}
              className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
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
            {isSelectedDocProcessing ? (
              <Button variant="outline" size="sm" onClick={handleStop}>
                <Square className="h-4 w-4 fill-current" />
                Stop
              </Button>
            ) : (
              <ButtonGroup>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleProcess}
                  disabled={!currentDoc}
                >
                  Process
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={!currentDoc}
                    >
                      <ChevronDown className="h-4 w-4" />
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
                  <Undo2 className="h-4 w-4" />
                  Unapprove
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={updateDocument.isPending || isSelectedDocProcessing}
                  className=" text-white"
                  variant="default"
                >
                  <Check className="h-4 w-4" />
                  Approve
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    className="h-8 w-8"
                    variant={
                      currentDoc.status === 'approved' ? 'secondary' : 'default'
                    }
                    disabled={
                      updateDocument.isPending || isSelectedDocProcessing
                    }
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleSaveFromHeader}
                    disabled={!hasUnsavedChanges}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleReject}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleClear}
                    className="text-orange-600 focus:text-orange-600 focus:bg-orange-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Data
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>

            {/* Keyboard Help Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Keyboard shortcuts"
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <h4 className="font-medium mb-2">Keyboard Shortcuts</h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Save</span>{' '}
                    <span className="flex items-center gap-0.5">
                      <Kbd>Ctrl</Kbd>+<Kbd>S</Kbd>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Approve</span>{' '}
                    <span className="flex items-center gap-0.5">
                      <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Process</span>{' '}
                    <span className="flex items-center gap-0.5">
                      <Kbd>Ctrl</Kbd>+<Kbd>P</Kbd>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reject</span>{' '}
                    <span className="flex items-center gap-0.5">
                      <Kbd>Ctrl</Kbd>+<Kbd>R</Kbd>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next doc</span>{' '}
                    <span className="flex items-center gap-0.5">
                      <Kbd>Ctrl</Kbd>+<Kbd>↓</Kbd>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prev doc</span>{' '}
                    <span className="flex items-center gap-0.5">
                      <Kbd>Ctrl</Kbd>+<Kbd>↑</Kbd>
                    </span>
                  </div>
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
        {/* Left: Document queue */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <DocumentQueue
            documentTypeId={docType.id}
            documentTypeSlug={docType.slug}
            selectedDocId={selectedDocId}
            urlSearch={urlSearch}
            urlStatus={urlStatus}
            urlPage={urlPage}
            onDocumentSelect={handleDocumentSelect}
            onSearchChange={handleSearchChange}
            onStatusChange={handleStatusChange}
            onPageChange={handlePageChange}
          />
        </ResizablePanel>

        <ResizableHandle />

        {/* Middle + Right: Child route (editor + preview) */}
        <ResizablePanel defaultSize={80} minSize={50}>
          <DocumentEditorProvider
            streamingData={
              streamingDocId === selectedDocId ? streamingData : null
            }
            isStreaming={isSelectedDocProcessing}
            registerSave={registerSave}
            hasUnsavedChanges={hasUnsavedChanges}
            setHasUnsavedChanges={setHasUnsavedChanges}
          >
            <Outlet />
          </DocumentEditorProvider>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
