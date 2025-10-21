'use client'

import React, { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateDocument, deleteDocument, rotateDocument, getDocuments as getDocumentsAction } from '@/lib/actions/document'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { DocumentQueue } from '@/components/document-queue'
// Removed: useStreamingJson - migrated to BullMQ with SSE

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataEditorTab } from './editor-tabs'
import { FormRenderer } from './form-renderer'
import { toast } from 'sonner'
import {
  Bot,
  CheckCircle,
  ArrowLeft,
  Undo2,
  Square,
  PlusIcon,
  ChevronsUpDownIcon,
  MousePointerClick,
  ChevronDown,
  Save,
  XCircle,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react'
import { Button } from './ui/button'
import { Spinner } from './ui/spinner'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from './ui/empty'
import { ThemeToggle } from './theme-toggle'
import { getAllModels, getAvailableProviders } from '@/lib/providers'
import { DEFAULT_MODEL } from '@/lib/providers/anthropic'
import { authClient } from '@/lib/auth-client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Combobox,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxInput,
  ComboboxList,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxCreateNew,
} from '@/components/ui/shadcn-io/combobox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ButtonGroup } from '@/components/ui/button-group'
import dynamic from 'next/dynamic'

const DocumentViewer = dynamic(() => import('@/components/document-viewer'), {
  ssr: false,
})

import type { DocumentSelect as Document } from '@/db/schema/app'
import type { GetDocumentsResult } from '@/lib/actions/document'

interface DocumentProcessorProps {
  documentType: {
    id: string
    name: string
    schema: any
    providerName?: string | null
    modelName?: string | null
  }
  initialDocumentsResult?: GetDocumentsResult
}

export function DocumentProcessor({
  documentType,
  initialDocumentsResult = { documents: [], total: 0, page: 1, pageSize: 50, totalPages: 0 },
}: DocumentProcessorProps) {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const [documents, setDocuments] = useState<Document[]>(initialDocumentsResult.documents)
  const [pagination, setPagination] = useState({
    page: initialDocumentsResult.page,
    pageSize: initialDocumentsResult.pageSize,
    total: initialDocumentsResult.total,
    totalPages: initialDocumentsResult.totalPages,
  })
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const selectedDocumentRef = React.useRef<string | null>(null) // Track selected doc for SSE callbacks
  const [formData, setFormData] = useState<any>(null)
  const [viewerFile, setViewerFile] = useState<{ name: string; url: string; type: string } | null>(
    null,
  )
  const [activeTab, setActiveTab] = useState('form')
  const [isPending, startTransition] = useTransition()
  const [overrideModel, setOverrideModel] = useState<string>(documentType.modelName || '')
  const [processingDocuments, setProcessingDocuments] = useState<Set<string>>(new Set())
  const processingDocumentsRef = React.useRef<Set<string>>(new Set())
  const [isBatchProcessing, setIsBatchProcessing] = useState(false)
  const eventSourceRef = React.useRef<EventSource | null>(null)
  const [batchQueue, setBatchQueue] = useState<string[]>([])
  const [documentJobStatuses, setDocumentJobStatuses] = useState<Record<string, any>>({})
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)

  // Show all models from all providers in one dropdown for admin overrides
  const allModels = getAllModels()

  // Check if user is admin
  const isAdmin = session?.user?.role === 'admin'

  // Track processing queue and results
  const [processingQueue, setProcessingQueue] = useState<string[]>([])
  const [currentlyProcessing, setCurrentlyProcessing] = useState<string | null>(null)

  // Cache streaming data for each processing document
  const processingDataCache = React.useRef<Map<string, any>>(new Map())
  // Track the current processing document ID (needed because state updates don't affect streaming callbacks)
  const processingDocumentId = React.useRef<string | null>(null)
  // Flag to prevent processing next document until current one is completely done (including auto-save)
  const isProcessingComplete = React.useRef<boolean>(true)

  // Sync initial documents result when it changes (e.g., after pagination)
  useEffect(() => {
    setDocuments(initialDocumentsResult.documents)
    setPagination({
      page: initialDocumentsResult.page,
      pageSize: initialDocumentsResult.pageSize,
      total: initialDocumentsResult.total,
      totalPages: initialDocumentsResult.totalPages,
    })
  }, [initialDocumentsResult])

  // Poll for job statuses of all visible documents (cross-session visibility)
  // With BullMQ + Redis, this is fast!
  useEffect(() => {
    if (documents.length === 0) {
      return
    }

    const pollJobStatuses = async () => {
      try {
        const documentIds = documents.map(d => d.id).join(',')
        const response = await fetch(`/api/jobs/by-documents?documentIds=${documentIds}`)

        if (response.ok) {
          const statuses = await response.json()
          setDocumentJobStatuses(statuses)
        }
      } catch (error) {
        console.error('Failed to poll job statuses:', error)
      }
    }

    // Poll immediately
    pollJobStatuses()

    // Then poll every 3 seconds
    const interval = setInterval(pollJobStatuses, 3000)

    return () => clearInterval(interval)
  }, [documents])

  // Removed: Old streaming-based queue processing
  // All processing now goes through BullMQ workers with SSE progress updates
  // See handleAiProcessing() and handleForceProcess() for the new implementation

  // Process multiple documents using job queue (background processing)
  const processBatchDocuments = async (docIds: string[]) => {
    const newDocIds = docIds.filter((id) => !processingDocuments.has(id) && !batchQueue.includes(id))

    if (newDocIds.length === 0) {
      return
    }

    setIsBatchProcessing(true)

    // Set up the batch queue (show clock icons)
    setBatchQueue(newDocIds)

    // Don't add to processingDocuments - rely on documentJobStatuses from polling
    // to show correct spinner/clock icons

    try {
      // Submit batch job
      const requestData = {
        documentIds: newDocIds,
        documentTypeId: documentType.id,
        schema: JSON.stringify(documentType.schema),
        // Add override model if admin has selected one
        ...(isAdmin &&
        overrideModel &&
        overrideModel !== (documentType.modelName || DEFAULT_MODEL)
          ? { model: overrideModel }
          : {}),
      }

      const response = await fetch('/api/jobs/batch-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        throw new Error(`Failed to submit batch job: ${response.statusText}`)
      }

      const { batchId, totalCount } = await response.json()
      setCurrentBatchId(batchId)

      // Track completed documents
      let completedDocuments = new Set<string>()

      // Connect to SSE endpoint for real-time updates
      const eventSource = new EventSource(`/api/jobs/events?batchId=${batchId}`)
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'connected') {
            return
          }

          if (data.type === 'completed' || data.type === 'failed') {
            const { documentId } = data

            // Mark document as completed
            completedDocuments.add(documentId)

            // Remove from batch queue
            setBatchQueue((prev) => prev.filter(id => id !== documentId))

            // Refetch documents to show updated status
            getDocumentsAction(documentType.id, {
              page: pagination.page,
              pageSize: pagination.pageSize,
            })
              .then(result => {
                setDocuments(result.documents)
                // Update selected document if it was in the batch
                if (selectedDocument && selectedDocument.id === documentId) {
                  const updatedDoc = result.documents.find((d: any) => d.id === documentId)
                  if (updatedDoc) {
                    setSelectedDocument(updatedDoc)
                    setFormData(updatedDoc.extractedData || {})
                  }
                }
              })
              .catch(err => console.error('Failed to refresh documents:', err))

            // Check if all jobs are done
            if (completedDocuments.size === totalCount) {
              eventSource.close()
              eventSourceRef.current = null

              setIsBatchProcessing(false)
              setBatchQueue([])
              setProcessingDocuments(new Set())

              // Final refresh
              getDocumentsAction(documentType.id, {
                page: pagination.page,
                pageSize: pagination.pageSize,
              })
                .then(result => {
                  setDocuments(result.documents)
                  setPagination({
                    page: result.page,
                    pageSize: result.pageSize,
                    total: result.total,
                    totalPages: result.totalPages,
                  })
                })
                .catch(err => console.error('Failed to refresh documents:', err))

              toast.success(`Batch processing completed: ${totalCount} documents processed`)
            }
          }
        } catch (error) {
          console.error('Error handling SSE event:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        eventSource.close()
        eventSourceRef.current = null

        setIsBatchProcessing(false)
        setBatchQueue([])

        // Fallback: refresh documents to check current state
        getDocumentsAction(documentType.id, {
          page: pagination.page,
          pageSize: pagination.pageSize,
        })
          .then(result => setDocuments(result.documents))
          .catch(err => console.error('Failed to refresh after error:', err))

        toast.error('Real-time updates disconnected. Refresh to see current status.')
      }

    } catch (error: any) {
      console.error('❌ Batch processing failed:', error)
      toast.error(`Failed to start batch processing: ${error.message}`)
      setIsBatchProcessing(false)
      setBatchQueue([])
      setProcessingDocuments(new Set())
    }
  }

  // Removed: addToProcessingQueue - old streaming queue system replaced by BullMQ

  // Handle processing completion
  // Removed: handleProcessingCompletion - no longer needed with BullMQ
  // Document updates now happen in the BullMQ worker, UI updates via SSE events

  const handleDocumentSelect = (doc: Document | null) => {
    if (doc && selectedDocument && doc.id === selectedDocument.id) {
      return // No change, do nothing
    }

    // DON'T close SSE - let it continue streaming in background
    // The progress events will update the cache, and we'll use cached data when switching back

    const processingId = processingDocumentId.current

    setSelectedDocument(doc)
    selectedDocumentRef.current = doc?.id || null // Update ref for SSE callbacks

    if (!doc) {
      setFormData({})
      return
    }

    // Priority order for form data:
    // 1. Use cached streaming data if available (from active or completed streaming)
    // 2. Otherwise use database data

    const cachedStreamingData = processingDataCache.current.get(doc.id)

    if (cachedStreamingData) {
      // Use cached streaming data (either from active processing or completed)
      setFormData(cachedStreamingData)
    } else {
      // No streaming data cached, use database data
      setFormData(doc.extractedData || {})
    }

    if (doc) {
      // Always cache bust on initial load to ensure we get current rotated state
      const fileUrl = `/api/documents/${doc.id}/file?t=${Date.now()}`
      setViewerFile({
        name: doc.filename,
        url: fileUrl,
        type: doc.filename.endsWith('.pdf') ? 'application/pdf' : 'image/png',
      })
    } else {
      setViewerFile(null)
    }
    setActiveTab('form')
  }

  const handleDataChange = (newData: any) => {
    setFormData(newData)
  }

  const handleAiProcessing = async () => {
    if (!selectedDocument) {
      toast.error('No document selected.')
      return
    }

    // Add to processing set for UI feedback
    setProcessingDocuments((prev) => {
      const newSet = new Set(prev)
      newSet.add(selectedDocument.id)
      return newSet
    })

    try {
      // Submit job to BullMQ
      const requestData = {
        documentId: selectedDocument.id,
        documentTypeId: documentType.id,
        schema: JSON.stringify(documentType.schema),
        ...(isAdmin && overrideModel && overrideModel !== (documentType.modelName || DEFAULT_MODEL)
          ? { model: overrideModel }
          : {}),
      }

      const response = await fetch('/api/jobs/process-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        throw new Error(`Failed to submit job: ${response.statusText}`)
      }

      const { jobId } = await response.json()
      setCurrentJobId(jobId)

      // Connect to SSE to stream progress
      const eventSource = new EventSource(`/api/jobs/events?jobId=${jobId}`)
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'connected') {
            return
          }

          if (data.type === 'progress' && data.progressData?.partialData) {
            // Always cache streaming data for this document (even if not currently selected)
            processingDataCache.current.set(data.documentId, data.progressData.partialData)

            // Only update form if this is the currently selected document (use ref to avoid stale closure)
            if (selectedDocumentRef.current === data.documentId) {
              setFormData(data.progressData.partialData)
            }
          }

          if (data.type === 'completed' || data.type === 'failed') {
            const { documentId } = data

            // Remove from processing state
            setProcessingDocuments((prev) => {
              const newSet = new Set(prev)
              newSet.delete(documentId)
              return newSet
            })

            eventSource.close()
            eventSourceRef.current = null

            // Refetch document to show updated status
            getDocumentsAction(documentType.id, {
              page: pagination.page,
              pageSize: pagination.pageSize,
            })
              .then(result => {
                setDocuments(result.documents)
                const updatedDoc = result.documents.find((d: any) => d.id === documentId)
                if (updatedDoc && selectedDocument?.id === documentId) {
                  setSelectedDocument(updatedDoc)
                  setFormData(updatedDoc.extractedData || {})
                }
              })
              .catch(err => console.error('Failed to refresh documents:', err))

            if (data.type === 'completed') {
              toast.success('Document processed successfully')
            } else {
              toast.error(`Processing failed: ${data.error}`)
            }
          }
        } catch (error) {
          console.error('Error handling SSE event:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        eventSource.close()
        eventSourceRef.current = null

        setProcessingDocuments((prev) => {
          const newSet = new Set(prev)
          newSet.delete(selectedDocument.id)
          return newSet
        })

        toast.error('Connection lost. Refresh to see current status.')
      }
    } catch (error: any) {
      console.error('Failed to process document:', error)
      toast.error(`Failed to start processing: ${error.message}`)

      setProcessingDocuments((prev) => {
        const newSet = new Set(prev)
        newSet.delete(selectedDocument.id)
        return newSet
      })
    }
  }

  const handleForceProcess = async () => {
    if (!selectedDocument) {
      toast.error('No document selected.')
      return
    }

    // Add to processing set for UI feedback
    setProcessingDocuments((prev) => {
      const newSet = new Set(prev)
      newSet.add(selectedDocument.id)
      return newSet
    })

    try {
      // Submit job to BullMQ with skipValidation
      const requestData = {
        documentId: selectedDocument.id,
        documentTypeId: documentType.id,
        schema: JSON.stringify(documentType.schema),
        skipValidation: true,
        ...(isAdmin && overrideModel && overrideModel !== (documentType.modelName || DEFAULT_MODEL)
          ? { model: overrideModel }
          : {}),
      }

      const response = await fetch('/api/jobs/process-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        throw new Error(`Failed to submit job: ${response.statusText}`)
      }

      const { jobId } = await response.json()
      setCurrentJobId(jobId)

      // Connect to SSE to stream progress
      const eventSource = new EventSource(`/api/jobs/events?jobId=${jobId}`)
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'progress' && data.progressData?.partialData) {
            // Always cache streaming data for this document (even if not currently selected)
            processingDataCache.current.set(data.documentId, data.progressData.partialData)

            // Only update form if this is the currently selected document (use ref to avoid stale closure)
            if (selectedDocumentRef.current === data.documentId) {
              setFormData(data.progressData.partialData)
            }
          }

          if (data.type === 'completed' || data.type === 'failed') {
            const { documentId } = data

            setProcessingDocuments((prev) => {
              const newSet = new Set(prev)
              newSet.delete(documentId)
              return newSet
            })

            eventSource.close()
            eventSourceRef.current = null

            // Refetch document to show updated status
            getDocumentsAction(documentType.id, {
              page: pagination.page,
              pageSize: pagination.pageSize,
            })
              .then(result => {
                setDocuments(result.documents)
                const updatedDoc = result.documents.find((d: any) => d.id === documentId)
                if (updatedDoc && selectedDocument?.id === documentId) {
                  setSelectedDocument(updatedDoc)
                  setFormData(updatedDoc.extractedData || {})
                }
              })
              .catch(err => console.error('Failed to refresh documents:', err))

            if (data.type === 'completed') {
              toast.success('Document force-processed successfully (validation bypassed)')
            } else {
              toast.error(`Force processing failed: ${data.error}`)
            }
          }
        } catch (error) {
          console.error('Error handling SSE event:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        eventSource.close()
        eventSourceRef.current = null

        setProcessingDocuments((prev) => {
          const newSet = new Set(prev)
          newSet.delete(selectedDocument.id)
          return newSet
        })

        toast.error('Connection lost. Refresh to see current status.')
      }
    } catch (error: any) {
      console.error('Failed to force process document:', error)
      toast.error(`Force Process Error: ${error.message}`)

      setProcessingDocuments((prev) => {
        const newSet = new Set(prev)
        newSet.delete(selectedDocument.id)
        return newSet
      })
    }
  }

  // Process all pending documents using batch processing (non-streaming)
  const handleProcessAllPending = async () => {
    const pendingDocs = documents.filter((doc) => doc.status === 'pending')
    if (pendingDocs.length === 0) {
      toast.error('No pending documents to process.')
      return
    }

    // Use batch processing (non-streaming) which is much more reliable
    await processBatchDocuments(pendingDocs.map((d) => d.id))
  }

  // Stop only the currently viewed document if it's being processed
  const handleStopCurrentDocument = async (docId?: string) => {
    const targetDocId = docId || selectedDocument?.id
    if (!targetDocId) return

    try {
      // Cancel the job via API
      const jobId = `process-doc-${targetDocId}`
      const response = await fetch('/api/jobs/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })

      if (!response.ok) {
        throw new Error('Failed to cancel job')
      }
      // Remove this document from processing state
      setProcessingDocuments((prev) => {
        const newSet = new Set(prev)
        newSet.delete(targetDocId)
        return newSet
      })

      // Remove from batch queue if present
      setBatchQueue((prev) => prev.filter(id => id !== targetDocId))

      // If this was the last document in batch, stop batch processing
      if (batchQueue.length <= 1) {
        setIsBatchProcessing(false)
        setCurrentBatchId(null)
      }

      // Clear currentJobId if this was the single job
      if (currentJobId === jobId) {
        setCurrentJobId(null)
        // Close SSE connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
          eventSourceRef.current = null
        }
      }

      toast.success('Processing stopped')
    } catch (error) {
      console.error('Failed to stop document:', error)
      toast.error('Failed to stop processing')
    }
  }

  // Stop single document processing - no longer needed with BullMQ
  // Jobs are managed by workers, can't be cancelled from client
  // Keep function for backwards compatibility but it's effectively a no-op
  const handleStopCurrentProcessing = () => {
    // With BullMQ, we just clear local UI state
    // The actual job continues in the worker
    setProcessingDocuments(new Set())
  }

  // Stop all processing (both single and batch)
  const handleStopAllProcessing = async () => {
    try {
      // Cancel the batch via API if we have a batchId
      if (currentBatchId) {
        const response = await fetch('/api/jobs/cancel-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchId: currentBatchId }),
        })

        if (!response.ok) {
          throw new Error('Failed to cancel batch')
        }

        setCurrentBatchId(null)
      }

      // Close SSE connection if running
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }

      setBatchQueue([])
      setProcessingDocuments(new Set())
      setIsBatchProcessing(false)

      toast.success('Batch processing stopped')
    } catch (error) {
      console.error('Failed to stop processing:', error)
      toast.error('Failed to stop processing')
    }
  }

  const handleStatusUpdate = async (status: 'approved' | 'processed' | 'pending' | 'rejected') => {
    if (!selectedDocument) return

    startTransition(async () => {
      try {
        const formDataToSubmit = new FormData()
        formDataToSubmit.append('extractedData', JSON.stringify(formData))
        formDataToSubmit.append('status', status)

        if (status === 'approved') {
          formDataToSubmit.append('schemaSnapshot', JSON.stringify(documentType.schema))
        }

        const updatedDoc = await updateDocument(selectedDocument.id, formDataToSubmit)

        setSelectedDocument(updatedDoc)
        setDocuments(documents.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)))

        const message = `Document "${updatedDoc.filename}" status set to ${status}.`
        if (status === 'approved') {
          toast.success(`Approved! ${message}`)
        } else if (status === 'rejected') {
          toast.success(`Rejected: ${message}`)
        } else if (status === 'pending') {
          toast.success(`Cleared: ${message}`)
        } else {
          toast.success(`Status Updated: ${message}`)
        }
      } catch (error: any) {
        toast.error(`Save Error: ${error.message}`)
      }
    })
  }

  const handleSaveWithoutStatusChange = async () => {
    if (!selectedDocument) return

    startTransition(async () => {
      try {
        const formDataToSubmit = new FormData()
        formDataToSubmit.append('extractedData', JSON.stringify(formData))
        // Keep current status
        formDataToSubmit.append('status', selectedDocument.status)

        const updatedDoc = await updateDocument(selectedDocument.id, formDataToSubmit)

        setSelectedDocument(updatedDoc)
        setDocuments(documents.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)))

        toast.success(`Saved changes to "${updatedDoc.filename}"`)
      } catch (error: any) {
        toast.error(`Save Error: ${error.message}`)
      }
    })
  }

  const handleClearDocument = async () => {
    if (!selectedDocument) return

    startTransition(async () => {
      try {
        const formDataToSubmit = new FormData()
        formDataToSubmit.append('extractedData', JSON.stringify({})) // Clear data
        formDataToSubmit.append('status', 'pending')

        const updatedDoc = await updateDocument(selectedDocument.id, formDataToSubmit)

        setSelectedDocument(updatedDoc)
        setDocuments(documents.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)))
        setFormData({}) // Clear form data in UI

        toast.success(`Cleared document "${updatedDoc.filename}"`)
      } catch (error: any) {
        toast.error(`Clear Error: ${error.message}`)
      }
    })
  }

  const handleDelete = async (docId: string) => {
    startTransition(async () => {
      try {
        await deleteDocument(docId)

        toast.success('Document deleted.')

        // Update state
        setDocuments((docs) => docs.filter((d) => d.id !== docId))
        if (selectedDocument?.id === docId) {
          handleDocumentSelect(null)
        }
      } catch (error: any) {
        toast.error(`Delete Error: ${error.message}`)
      }
    })
  }

  const handleUploadSuccess = () => {
    // Refresh the page to get updated documents from server
    router.refresh()
  }

  return (
    <div className="flex h-full w-full flex-col">
      <header className="border-border flex flex-shrink-0 items-center gap-4 border-b px-6 py-3">
        <Button variant="outline" size="icon" asChild>
          <Link href="/document-types">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <h1 className="truncate text-xl font-semibold">
          <span className="hidden sm:inline">{documentType.name}: </span>
          <span className="text-muted-foreground font-normal">
            {selectedDocument?.filename || 'No document selected'}
          </span>
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {/* Model Override - Admin only */}
          {isAdmin && (
            <Combobox
              data={allModels.map((model) => ({
                label: model.id,
                value: model.id,
              }))}
              type="model"
              value={overrideModel}
              onValueChange={setOverrideModel}
            >
              <ComboboxTrigger className="min-w-72">
                <span className="flex w-full items-center justify-between gap-2">
                  {overrideModel || `Select model...`}
                  <ChevronsUpDownIcon className="text-muted-foreground shrink-0" size={16} />
                </span>
              </ComboboxTrigger>
              <ComboboxContent>
                <ComboboxInput placeholder="Search or type model..." />
                <ComboboxList>
                  <ComboboxGroup>
                    {allModels.map((model) => (
                      <ComboboxItem key={model.id} value={model.id}>
                        <span className="truncate">{model.id}</span>
                      </ComboboxItem>
                    ))}
                  </ComboboxGroup>
                  <ComboboxCreateNew onCreateNew={(value) => setOverrideModel(value)}>
                    {(inputValue) => (
                      <>
                        <PlusIcon className="text-muted-foreground h-4 w-4" />
                        <span>Custom: "{inputValue}"</span>
                      </>
                    )}
                  </ComboboxCreateNew>
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          )}
          {selectedDocument && (processingDocuments.has(selectedDocument.id) || documentJobStatuses[selectedDocument.id]?.status === 'active') ? (
            <Button onClick={() => handleStopCurrentDocument()} variant="outline">
              <Square className="h-4 w-4" />
              Stop
            </Button>
          ) : (
            <ButtonGroup>
              <Button onClick={handleAiProcessing} disabled={!selectedDocument} variant="outline">
                <Bot className="h-4 w-4" />
                Process
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" disabled={!selectedDocument}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleForceProcess} disabled={!selectedDocument}>
                    <AlertTriangle className="h-4 w-4" />
                    Force Process
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
          )}
          <ButtonGroup>
            {selectedDocument?.status === 'approved' ? (
              <>
                <Button
                  onClick={() => handleStatusUpdate('processed')}
                  disabled={isPending || !selectedDocument}
                  variant="secondary"
                >
                  {isPending ? (
                    <Spinner />
                  ) : (
                    <Undo2 className="h-4 w-4" />
                  )}
                  Unapprove
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon" disabled={isPending || !selectedDocument}>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleSaveWithoutStatusChange} disabled={isPending}>
                      <Save className="h-4 w-4" />
                      Save
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleStatusUpdate('rejected')} disabled={isPending}>
                      <XCircle className="h-4 w-4" />
                      Reject
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleClearDocument} disabled={isPending}>
                      <RotateCcw className="h-4 w-4" />
                      Clear
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button
                  onClick={() => handleStatusUpdate('approved')}
                  disabled={isPending || !selectedDocument}
                >
                  {isPending ? (
                    <Spinner />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Approve
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" disabled={isPending || !selectedDocument}>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleSaveWithoutStatusChange} disabled={isPending}>
                      <Save className="h-4 w-4" />
                      Save
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleStatusUpdate('rejected')} disabled={isPending}>
                      <XCircle className="h-4 w-4" />
                      Reject
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleClearDocument} disabled={isPending}>
                      <RotateCcw className="h-4 w-4" />
                      Clear
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </ButtonGroup>
          <div className="border-border flex items-center gap-2 border-l pl-2">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <ResizablePanelGroup direction="horizontal" className="flex-grow">
        <ResizablePanel defaultSize={24} minSize={15}>
          <DocumentQueue
            documentTypeId={documentType.id}
            documents={documents}
            selectedDocument={selectedDocument}
            processingDocuments={processingDocuments}
            currentlyProcessing={currentlyProcessing}
            processingQueue={processingQueue}
            batchQueue={batchQueue}
            isBatchProcessing={isBatchProcessing}
            documentJobStatuses={documentJobStatuses}
            pagination={pagination}
            onSelect={handleDocumentSelect}
            onUploadSuccess={handleUploadSuccess}
            onDelete={handleDelete}
            onProcessAll={processBatchDocuments}
            onStopAll={handleStopAllProcessing}
            onStopDocument={handleStopCurrentDocument}
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={40} minSize={30}>
          <div className="flex h-full flex-col p-4">
            {selectedDocument ? (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
                <TabsList className="grid w-full flex-shrink-0 grid-cols-2">
                  <TabsTrigger value="form">Form</TabsTrigger>
                  <TabsTrigger value="data">Data</TabsTrigger>
                </TabsList>
                <div className="flex-grow overflow-y-auto pt-4">
                  <TabsContent value="form" className="space-y-4">
                    {/* Removed: Old streaming status indicators - now handled by SSE + processingDocuments state */}
                    {selectedDocument?.status === 'rejected' && selectedDocument?.rejectionReason && (
                      <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
                        <div className="text-sm text-red-700 dark:text-red-300">
                          <strong>Document Rejected:</strong> {selectedDocument.rejectionReason}
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleForceProcess}
                            disabled={processingDocuments.has(selectedDocument.id)}
                            className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900"
                          >
                            {processingDocuments.has(selectedDocument.id) ? (
                              <Spinner className="h-3 w-3" />
                            ) : (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            Force Process
                          </Button>
                        </div>
                      </div>
                    )}
                    <FormRenderer
                      key={selectedDocument.id}
                      schema={selectedDocument.schemaSnapshot || documentType.schema}
                      data={formData || {}}
                      onChange={handleDataChange}
                      isStreaming={false}
                    />
                  </TabsContent>
                  <TabsContent value="data" className="m-0 h-full">
                    {/* Removed: Old streaming status indicators - now handled by SSE + processingDocuments state */}
                    {selectedDocument?.status === 'rejected' && selectedDocument?.rejectionReason && (
                      <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
                        <div className="text-sm text-red-700 dark:text-red-300">
                          <strong>Document Rejected:</strong> {selectedDocument.rejectionReason}
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleForceProcess}
                            disabled={processingDocuments.has(selectedDocument.id)}
                            className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900"
                          >
                            {processingDocuments.has(selectedDocument.id) ? (
                              <Spinner className="h-3 w-3" />
                            ) : (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            Force Process
                          </Button>
                        </div>
                      </div>
                    )}
                    <DataEditorTab
                      value={JSON.stringify(formData || {}, null, 2)}
                      onChange={(text) => handleDataChange(JSON.parse(text || '{}'))}
                    />
                  </TabsContent>
                </div>
              </Tabs>
            ) : (
              <Empty className="h-full border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MousePointerClick />
                  </EmptyMedia>
                  <EmptyTitle>No document selected</EmptyTitle>
                  <EmptyDescription>
                    Select a document from the sidebar to view and edit its extracted data.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={36} minSize={25}>
          <DocumentViewer
            file={viewerFile}
            documentId={selectedDocument?.id}
            onRotationChange={async (degrees: number) => {
              if (!selectedDocument) return

              try {
                // Physically rotate the file
                await rotateDocument(selectedDocument.id, degrees)

                // Simple cache busting with timestamp
                const fileUrl = `/api/documents/${selectedDocument.id}/file?t=${Date.now()}`
                setViewerFile({
                  name: selectedDocument.filename,
                  url: fileUrl,
                  type: selectedDocument.filename.endsWith('.pdf')
                    ? 'application/pdf'
                    : 'image/png',
                })
              } catch (error) {
                toast.error('Failed to rotate document')
                console.error('Rotation error:', error)
              }
            }}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
