'use client'

import React, { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { updateDocument, deleteDocument, rotateDocument } from '@/lib/actions/document'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { DocumentQueue } from '@/components/document-queue'
import { useStreamingJson } from '@/hooks/use-streaming-json'

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
  const { data: session } = authClient.useSession()
  const [documents, setDocuments] = useState<Document[]>(initialDocumentsResult.documents)
  const [pagination, setPagination] = useState({
    page: initialDocumentsResult.page,
    pageSize: initialDocumentsResult.pageSize,
    total: initialDocumentsResult.total,
    totalPages: initialDocumentsResult.totalPages,
  })
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
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
  const batchProcessingController = React.useRef<AbortController | null>(null)
  const [batchQueue, setBatchQueue] = useState<string[]>([])

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

  // Main streaming hook for processing (back to simple text streaming)
  const { object, submit, isLoading, stop, error } = useStreamingJson({
    api: '/api/process-document?stream=true',
    onUpdate: (partialObject) => {
      const processingId = processingDocumentId.current
      if (processingId && partialObject) {
        // Always cache the streaming data for this document
        processingDataCache.current.set(processingId, partialObject)

        // Only update form data if we're viewing the currently processing document
        if (selectedDocument?.id === processingId) {
          setFormData(partialObject)
        }
      }
    },
    onFinish: (finalObject) => {
      const processingId = processingDocumentId.current
      if (finalObject && processingId) {
        // Check if this is a rejected document (has status === 'rejected')
        if (finalObject.status === 'rejected') {
          // Update UI with rejected document
          setDocuments((prev) => prev.map((d) => (d.id === processingId ? finalObject : d)))
          if (selectedDocument?.id === processingId) {
            setSelectedDocument(finalObject)
          }

          // Clean up processing state
          setCurrentlyProcessing(null)
          processingDocumentId.current = null
          isProcessingComplete.current = true

          setProcessingDocuments((prev) => {
            const newSet = new Set(prev)
            newSet.delete(processingId)
            return newSet
          })
          processingDataCache.current.delete(processingId)

          // Process next document in queue
          processNextInQueue()
        } else {
          // Normal processing completion
          handleProcessingCompletion(processingId, finalObject)
        }
      }
    },
    onError: (error) => {
      const processingId = processingDocumentId.current

      // Show error toast for actual errors (model returning text instead of JSON, etc.)
      toast.error(`Processing Error: ${error.message}`)

      if (processingId) {
        setProcessingDocuments((prev) => {
          const newSet = new Set(prev)
          newSet.delete(processingId)
          return newSet
        })
        processingDataCache.current.delete(processingId)
      }

      setCurrentlyProcessing(null)
      processingDocumentId.current = null
      isProcessingComplete.current = true
      processNextInQueue()
    },
  })

  // Function to process the next document in the queue
  const processNextInQueue = () => {
    if (!isProcessingComplete.current) {
      return
    }

    setProcessingQueue((queue) => {
      if (queue.length === 0) {
        return queue
      }

      const [nextDocId, ...remainingQueue] = queue

      // Start processing immediately
      setTimeout(() => startProcessingDocument(nextDocId), 100)

      return remainingQueue
    })
  }

  // Function to start processing a specific document
  const startProcessingDocument = (docId: string) => {
    const doc = documents.find((d) => d.id === docId)
    if (!doc) {
      // Mark as complete so we can continue with next document
      isProcessingComplete.current = true
      processNextInQueue()
      return
    }

    // Mark processing as not complete
    isProcessingComplete.current = false

    setCurrentlyProcessing(docId)

    // Prepare the data for the streaming API
    const requestData = {
      documentId: docId,
      documentTypeId: documentType.id,
      schema: JSON.stringify(documentType.schema), // Always use latest schema for processing
      // Add override model if admin has selected one that's different from document type default
      ...(isAdmin && overrideModel && overrideModel !== (documentType.modelName || DEFAULT_MODEL)
        ? { model: overrideModel }
        : {}),
    }

    // Store the docId we're about to process so the streaming callbacks can access it
    processingDocumentId.current = docId
    submit(requestData)
  }

  // Process multiple documents using non-streaming API (much more reliable for batch)
  const processBatchDocuments = async (docIds: string[]) => {
    const newDocIds = docIds.filter((id) => !processingDocuments.has(id) && !batchQueue.includes(id))

    if (newDocIds.length === 0) {
      return
    }

    // Create new AbortController for this batch
    const controller = new AbortController()
    batchProcessingController.current = controller

    setIsBatchProcessing(true)
    
    // Set up the batch queue (show clock icons)
    setBatchQueue(newDocIds)

    try {
      // Process each document sequentially using non-streaming API
      for (const docId of newDocIds) {
        // Check if processing was cancelled
        if (controller.signal.aborted) {
          break
        }

        try {
          // Move from queue to processing (clock → spinner)
          setBatchQueue(prev => prev.filter(id => id !== docId))
          setProcessingDocuments((prev) => {
            const newSet = new Set(prev)
            newSet.add(docId)
            return newSet
          })

          const doc = documents.find((d) => d.id === docId)
          if (!doc) {
            setProcessingDocuments((prev) => {
              const newSet = new Set(prev)
              newSet.delete(docId)
              return newSet
            })
            continue
          }

          // Check if document was originally pending
          const wasOriginallyPending = doc.status === 'pending'

          const requestData = {
            documentId: docId,
            documentTypeId: documentType.id,
            schema: JSON.stringify(documentType.schema), // Always use latest schema for processing
            // Add override model if admin has selected one
            ...(isAdmin &&
            overrideModel &&
            overrideModel !== (documentType.modelName || DEFAULT_MODEL)
              ? { model: overrideModel }
              : {}),
          }

          // Use non-streaming API (no ?stream=true parameter) with abort signal
          const response = await fetch('/api/process-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData),
            signal: controller.signal,
          })

          const result = await response.json()

          // Check if this is a validation rejection (rejected flag in response)
          if (result.rejected && result.document) {
            // Update UI with rejected document from response
            setDocuments((prev) => prev.map((d) => (d.id === docId ? result.document : d)))
            if (selectedDocument?.id === docId) {
              setSelectedDocument(result.document)
            }

            // Remove from processing set before continuing
            setProcessingDocuments((prev) => {
              const newSet = new Set(prev)
              newSet.delete(docId)
              return newSet
            })

            // Don't throw error toast for validation rejections - they're expected
            continue
          }

          if (!response.ok || !result.success) {
            // Extract meaningful error message for other errors
            const errorMessage = result.message || result.error || `API request failed: ${response.status} ${response.statusText}`
            throw new Error(errorMessage)
          }

          const extractedData = result.data

          // Update document state immediately
          setDocuments((prev) =>
            prev.map((d) => {
              if (d.id === docId) {
                const updatedDoc = {
                  ...d,
                  extractedData,
                  status: 'processed' as const,
                }

                // Update form if we're viewing this document
                if (selectedDocument?.id === docId) {
                  setFormData(extractedData)
                  setSelectedDocument(updatedDoc)
                }

                return updatedDoc
              }
              return d
            }),
          )

          // Always save after processing (both first time and reprocessing)
          const formDataToSubmit = new FormData()
          formDataToSubmit.append('extractedData', JSON.stringify(extractedData))
          formDataToSubmit.append('status', 'processed')
          formDataToSubmit.append(
            'schemaSnapshot',
            JSON.stringify(documentType.schema), // Save current schema as snapshot
          )

          const savedDoc = await updateDocument(docId, formDataToSubmit)

          // Update documents state with saved version
          setDocuments((prev) => prev.map((d) => (d.id === docId ? savedDoc : d)))
          if (selectedDocument?.id === docId) {
            setSelectedDocument(savedDoc)
          }
        } catch (error: any) {
          // Handle AbortError separately from other errors
          if (error.name !== 'AbortError') {
            // Only log actual errors, not validation rejections
            if (!error.message.includes('Document validation failed')) {
              console.error('❌ Failed to process document:', docId, error)
            }
            toast.error(`Failed to process document: ${error.message}`)
          }
        }

        // Remove from processing set
        setProcessingDocuments((prev) => {
          const newSet = new Set(prev)
          newSet.delete(docId)
          return newSet
        })
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('❌ Batch processing failed:', error)
      }
    } finally {
      // Always clean up, whether completed or cancelled
      setIsBatchProcessing(false)
      setBatchQueue([])
      batchProcessingController.current = null
    }
  }

  // Add documents to processing queue (streaming mode - for single documents)
  const addToProcessingQueue = (docIds: string[]) => {
    const newDocIds = docIds.filter(
      (id) => !processingQueue.includes(id) && id !== currentlyProcessing,
    )

    if (newDocIds.length === 0) {
      return
    }

    // If nothing is currently processing, start the first one immediately
    if (
      !isLoading &&
      !currentlyProcessing &&
      processingQueue.length === 0 &&
      isProcessingComplete.current
    ) {
      const [firstDoc, ...restDocs] = newDocIds

      setProcessingDocuments((prev) => {
        const newSet = new Set(prev)
        newDocIds.forEach((id) => newSet.add(id))
        return newSet
      })

      if (restDocs.length > 0) {
        setProcessingQueue(restDocs)
      }

      startProcessingDocument(firstDoc)
    } else {
      // Add all to queue
      setProcessingQueue((prev) => [...prev, ...newDocIds])
      setProcessingDocuments((prev) => {
        const newSet = new Set(prev)
        newDocIds.forEach((id) => newSet.add(id))
        return newSet
      })
    }
  }

  // Handle processing completion
  const handleProcessingCompletion = async (processingId: string, finalObject: any) => {
    // Find the document that was being processed and update it
    let wasOriginallyPending = false
    let updatedDoc: any = null

    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === processingId) {
          wasOriginallyPending = doc.status === 'pending'
          updatedDoc = {
            ...doc,
            extractedData: finalObject,
            status: 'processed' as const,
          }

          // Only update form data and selected document if we're still viewing this document
          if (selectedDocument?.id === processingId) {
            setFormData(finalObject)
            setSelectedDocument(updatedDoc)
          }

          return updatedDoc
        }
        return doc
      }),
    )

    // Always save after processing (both first time and reprocessing)
    startTransition(async () => {
      try {
        const formDataToSubmit = new FormData()
        formDataToSubmit.append('extractedData', JSON.stringify(finalObject))
        formDataToSubmit.append('status', 'processed')
        formDataToSubmit.append(
          'schemaSnapshot',
          JSON.stringify(documentType.schema), // Save current schema as snapshot
        )

        const result = await updateDocument(processingId, formDataToSubmit)

        // Update the document in our state with the saved version
        if (result) {
          setDocuments((prev) => prev.map((d) => (d.id === processingId ? result : d)))
          if (selectedDocument?.id === processingId) {
            setSelectedDocument(result)
          }
        }
      } catch (error: any) {
        console.error('❌ Failed to auto-save processed document:', error)
        toast.error(`Failed to save processed document: ${error.message}`)
      }
    })

    // Clean up processing state
    setCurrentlyProcessing(null)
    processingDocumentId.current = null
    isProcessingComplete.current = true

    setProcessingDocuments((prev) => {
      const newSet = new Set(prev)
      newSet.delete(processingId)
      return newSet
    })

    // Process next document in queue
    processNextInQueue()
  }

  const handleDocumentSelect = (doc: Document | null) => {
    if (doc && selectedDocument && doc.id === selectedDocument.id) {
      return // No change, do nothing
    }

    const processingId = processingDocumentId.current

    setSelectedDocument(doc)

    if (!doc) {
      setFormData({})
      return
    }

    // Priority order for form data:
    // 1. If this document is currently being processed, use latest streaming data
    // 2. If we have cached streaming data from when it was processed, use that
    // 3. Otherwise use database data

    const cachedStreamingData = processingDataCache.current.get(doc.id)

    if (doc.id === processingId && cachedStreamingData) {
      setFormData(cachedStreamingData)
    } else if (cachedStreamingData && !processingDocuments.has(doc.id)) {
      // Document was processed and we have final streaming data, but it's not currently processing
      setFormData(cachedStreamingData)
    } else if (processingDocuments.has(doc.id)) {
      // Document is queued for processing but not started yet
      setFormData(doc.extractedData || {})
    } else {
      // Normal document, use database data
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

    // Process immediately, bypassing any queue
    startProcessingDocument(selectedDocument.id)
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
      const requestData = {
        documentId: selectedDocument.id,
        documentTypeId: documentType.id,
        schema: JSON.stringify(documentType.schema),
        ...(isAdmin && overrideModel && overrideModel !== (documentType.modelName || DEFAULT_MODEL)
          ? { model: overrideModel }
          : {}),
      }

      // Use non-streaming API with skipValidation flag
      const response = await fetch('/api/process-document?skipValidation=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        const errorMessage = result.message || result.error || `API request failed: ${response.status} ${response.statusText}`
        throw new Error(errorMessage)
      }

      const extractedData = result.data

      // Update document state immediately
      const updatedDoc = {
        ...selectedDocument,
        extractedData,
        status: 'processed' as const,
        rejectionReason: null, // Clear rejection reason
      }

      setSelectedDocument(updatedDoc)
      setFormData(extractedData)
      setDocuments((prev) => prev.map((d) => (d.id === selectedDocument.id ? updatedDoc : d)))

      // Save to database
      const formDataToSubmit = new FormData()
      formDataToSubmit.append('extractedData', JSON.stringify(extractedData))
      formDataToSubmit.append('status', 'processed')
      formDataToSubmit.append('schemaSnapshot', JSON.stringify(documentType.schema))

      const savedDoc = await updateDocument(selectedDocument.id, formDataToSubmit)

      setSelectedDocument(savedDoc)
      setDocuments((prev) => prev.map((d) => (d.id === selectedDocument.id ? savedDoc : d)))

      toast.success('Document force-processed successfully (validation bypassed)')
    } catch (error: any) {
      toast.error(`Force Process Error: ${error.message}`)
    } finally {
      // Remove from processing set
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
  const handleStopCurrentDocument = () => {
    if (!selectedDocument) return
    
    // Stop streaming processing if this is the document being streamed
    if (currentlyProcessing === selectedDocument.id && isLoading) {
      stop()
      setCurrentlyProcessing(null)
      processingDocumentId.current = null
      isProcessingComplete.current = true
      // Continue with next document in queue
      processNextInQueue()
    }
    
    // Remove this document from processing state (works for both streaming and batch)
    setProcessingDocuments((prev) => {
      const newSet = new Set(prev)
      newSet.delete(selectedDocument.id)
      return newSet
    })
    
    toast.success('Document processing stopped.')
  }

  // Stop single document processing (streaming) and clear queue
  const handleStopCurrentProcessing = () => {
    if (isLoading) {
      stop()
    }

    // Clear the processing queue and reset state
    setProcessingQueue([])
    setCurrentlyProcessing(null)
    setProcessingDocuments(new Set())
    processingDocumentId.current = null
    isProcessingComplete.current = true
  }

  // Stop all processing (both single and batch)
  const handleStopAllProcessing = () => {
    // Stop streaming processing
    if (isLoading) {
      stop()
    }

    // Abort batch processing if running
    if (batchProcessingController.current) {
      batchProcessingController.current.abort()
    }

    setProcessingQueue([])
    setBatchQueue([])
    setCurrentlyProcessing(null)
    setProcessingDocuments(new Set())
    setIsBatchProcessing(false)
    processingDocumentId.current = null
    isProcessingComplete.current = true
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
    window.location.reload()
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
          {selectedDocument && processingDocuments.has(selectedDocument.id) ? (
            <Button onClick={handleStopCurrentDocument} variant="outline">
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
            pagination={pagination}
            onSelect={handleDocumentSelect}
            onUploadSuccess={handleUploadSuccess}
            onDelete={handleDelete}
            onProcessAll={processBatchDocuments}
            onStopAll={handleStopAllProcessing}
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
                    {isLoading && selectedDocument?.id === currentlyProcessing && (
                      <div className="sticky top-0 z-10 mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 shadow-sm dark:border-blue-800 dark:bg-blue-950">
                        <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                          <Spinner />
                          Extracting data from document...
                        </div>
                      </div>
                    )}
                    {error && selectedDocument?.id === currentlyProcessing && (
                      <div
                        className={`mb-4 rounded-md border p-3 ${
                          error.message.includes('Rate limit exceeded')
                            ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950'
                            : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
                        }`}
                      >
                        <div
                          className={`text-sm ${
                            error.message.includes('Rate limit exceeded')
                              ? 'text-yellow-700 dark:text-yellow-300'
                              : 'text-red-700 dark:text-red-300'
                          }`}
                        >
                          {error.message.includes('Rate limit exceeded') ? (
                            <>
                              <strong>Rate Limit Reached:</strong>{' '}
                              {error.message.replace('Rate limit exceeded: ', '')}
                            </>
                          ) : (
                            <>Error: {error.message}</>
                          )}
                        </div>
                      </div>
                    )}
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
                      isStreaming={isLoading}
                    />
                  </TabsContent>
                  <TabsContent value="data" className="m-0 h-full">
                    {isLoading && selectedDocument?.id === currentlyProcessing && (
                      <div className="sticky top-0 z-10 mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 shadow-sm dark:border-blue-800 dark:bg-blue-950">
                        <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                          <Spinner />
                          Extracting data from document...
                        </div>
                      </div>
                    )}
                    {error && selectedDocument?.id === currentlyProcessing && (
                      <div
                        className={`mb-4 rounded-md border p-3 ${
                          error.message.includes('Rate limit exceeded')
                            ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950'
                            : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
                        }`}
                      >
                        <div
                          className={`text-sm ${
                            error.message.includes('Rate limit exceeded')
                              ? 'text-yellow-700 dark:text-yellow-300'
                              : 'text-red-700 dark:text-red-300'
                          }`}
                        >
                          {error.message.includes('Rate limit exceeded') ? (
                            <>
                              <strong>Rate Limit Reached:</strong>{' '}
                              {error.message.replace('Rate limit exceeded: ', '')}
                            </>
                          ) : (
                            <>Error: {error.message}</>
                          )}
                        </div>
                      </div>
                    )}
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
