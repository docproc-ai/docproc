'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { updateDocument, deleteDocument } from '@/lib/actions/document'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { DocumentQueue } from '@/components/document-queue'
import { useStreamingJson } from '@/hooks/use-streaming-json'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataEditorTab } from './editor-tabs'
import { FormRenderer } from './form-renderer'
import { toast } from 'sonner'
import { Bot, Loader2, CheckCircle, ArrowLeft, Undo2, Square } from 'lucide-react'
import { Button } from './ui/button'
import { ThemeToggle } from './theme-toggle'
import { ANTHROPIC_MODELS, DEFAULT_MODEL } from '@/lib/models/anthropic'
import { authClient } from '@/lib/auth-client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import dynamic from 'next/dynamic'

const DocumentViewer = dynamic(() => import('@/components/document-viewer'), {
  ssr: false,
})

import type { DocumentSelect as Document } from '@/db/schema/app'

interface DocumentProcessorProps {
  documentType: {
    id: string
    name: string
    schema: any
    modelName?: string | null
  }
  initialDocuments?: Document[]
}

export function DocumentProcessor({ documentType, initialDocuments = [] }: DocumentProcessorProps) {
  const { data: session } = authClient.useSession()
  const [documents, setDocuments] = useState<Document[]>(initialDocuments)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [formData, setFormData] = useState<any>(null)
  const [viewerFile, setViewerFile] = useState<{ name: string; url: string; type: string } | null>(
    null,
  )
  const [activeTab, setActiveTab] = useState('form')
  const [isPending, startTransition] = useTransition()
  const [overrideModel, setOverrideModel] = useState<string>(
    documentType.modelName || DEFAULT_MODEL,
  )

  // Check if user is admin
  const isAdmin = session?.user?.role === 'admin'

  // Custom streaming JSON hook
  const { object, submit, isLoading, stop, error } = useStreamingJson({
    api: '/api/process-document',
    onUpdate: (partialObject) => {
      // Update form data on every chunk during streaming
      setFormData(partialObject)
    },
    onFinish: (finalObject) => {
      if (finalObject && selectedDocument) {
        // Update the form data with the final object
        setFormData(finalObject)
        
        // Update the document in state
        const updatedDoc = {
          ...selectedDocument,
          extractedData: finalObject,
          status: 'processed' as const,
        }
        setSelectedDocument(updatedDoc)
        setDocuments(documents.map((d) => (d.id === selectedDocument.id ? updatedDoc : d)))

        toast.success('Document processed by AI.')
      }
    },
    onError: (error) => {
      toast.error(`Processing Error: ${error.message}`)
    },
  })

  // Update form data when streaming object changes
  React.useEffect(() => {
    if (object) {
      setFormData(object)
    }
  }, [object])

  const handleDocumentSelect = (doc: Document | null) => {
    if (doc && selectedDocument && doc.id === selectedDocument.id) {
      return // No change, do nothing
    }
    setSelectedDocument(doc)
    setFormData(doc?.extractedData || {})
    if (doc) {
      // Create a URL with the document type ID as a query parameter for the file endpoint
      const fileUrl = `/api/documents/${doc.id}/file?documentTypeId=${documentType.id}`
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

    // Prepare the data for the streaming API
    const requestData = {
      documentId: selectedDocument.id,
      documentTypeId: documentType.id,
      schema: JSON.stringify(selectedDocument.schemaSnapshot || documentType.schema),
      // Add override model if admin has selected one that's different from document type default
      ...(isAdmin && overrideModel && overrideModel !== (documentType.modelName || DEFAULT_MODEL) 
        ? { model: overrideModel } 
        : {}),
    }

    // Start streaming with useObject
    submit(requestData)
  }

  const handleStatusUpdate = async (status: 'approved' | 'processed') => {
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
        } else {
          toast.success(`Status Updated: ${message}`)
        }
      } catch (error: any) {
        toast.error(`Save Error: ${error.message}`)
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
            <Select value={overrideModel} onValueChange={setOverrideModel}>
              <SelectTrigger id="model-override" className="">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANTHROPIC_MODELS.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                    {model === (documentType.modelName || DEFAULT_MODEL) ? ' (default)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isLoading ? (
            <Button onClick={stop} variant="outline">
              <Square className="h-4 w-4" />
              Stop
            </Button>
          ) : (
            <Button
              onClick={handleAiProcessing}
              disabled={isLoading || !selectedDocument}
              variant="outline"
            >
              <Bot className="h-4 w-4" />
              Process
            </Button>
          )}
          {selectedDocument?.status === 'approved' ? (
            <Button
              onClick={() => handleStatusUpdate('processed')}
              disabled={isPending || !selectedDocument}
              variant="secondary"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Undo2 className="h-4 w-4" />
              )}
              Unapprove
            </Button>
          ) : (
            <Button
              onClick={() => handleStatusUpdate('approved')}
              disabled={isPending || !selectedDocument}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Approve
            </Button>
          )}
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
            onSelect={handleDocumentSelect}
            onUploadSuccess={handleUploadSuccess}
            onDelete={handleDelete}
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
                    {isLoading && (
                      <div className="sticky top-0 z-10 mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 shadow-sm dark:border-blue-800 dark:bg-blue-950">
                        <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Extracting data from document...
                        </div>
                      </div>
                    )}
                    {error && (
                      <div className={`mb-4 rounded-md border p-3 ${
                        error.message.includes('Rate limit exceeded') 
                          ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950'
                          : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
                      }`}>
                        <div className={`text-sm ${
                          error.message.includes('Rate limit exceeded')
                            ? 'text-yellow-700 dark:text-yellow-300'
                            : 'text-red-700 dark:text-red-300'
                        }`}>
                          {error.message.includes('Rate limit exceeded') ? (
                            <>
                              <strong>Rate Limit Reached:</strong> {error.message.replace('Rate limit exceeded: ', '')}
                            </>
                          ) : (
                            <>Error: {error.message}</>
                          )}
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
                    {isLoading && (
                      <div className="sticky top-0 z-10 mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 shadow-sm dark:border-blue-800 dark:bg-blue-950">
                        <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Extracting data from document...
                        </div>
                      </div>
                    )}
                    {error && (
                      <div className={`mb-4 rounded-md border p-3 ${
                        error.message.includes('Rate limit exceeded') 
                          ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950'
                          : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
                      }`}>
                        <div className={`text-sm ${
                          error.message.includes('Rate limit exceeded')
                            ? 'text-yellow-700 dark:text-yellow-300'
                            : 'text-red-700 dark:text-red-300'
                        }`}>
                          {error.message.includes('Rate limit exceeded') ? (
                            <>
                              <strong>Rate Limit Reached:</strong> {error.message.replace('Rate limit exceeded: ', '')}
                            </>
                          ) : (
                            <>Error: {error.message}</>
                          )}
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
              <div className="flex h-full items-center justify-center">
                <p className="text-muted-foreground">Select a document to begin processing.</p>
              </div>
            )}
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={36} minSize={25}>
          <DocumentViewer file={viewerFile} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
