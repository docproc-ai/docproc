'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { updateDocument, deleteDocument, processDocument } from '@/lib/actions/document'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { DocumentQueue } from '@/components/document-queue'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataEditorTab } from './editor-tabs'
import { FormRenderer } from './form-renderer'
import { toast } from 'sonner'
import { Bot, Loader2, CheckCircle, ArrowLeft, Undo2 } from 'lucide-react'
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
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [overrideModel, setOverrideModel] = useState<string>(
    documentType.modelName || DEFAULT_MODEL,
  )

  // Check if user is admin
  const isAdmin = session?.user?.role === 'admin'

  const handleDocumentSelect = (doc: Document | null) => {
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

    setIsProcessing(true)
    try {
      // Use Server Action for processing
      const formData = new FormData()
      formData.append('documentId', selectedDocument.id)
      formData.append('documentTypeId', documentType.id)
      formData.append(
        'schema',
        JSON.stringify(selectedDocument.schemaSnapshot || documentType.schema),
      )
      // Add override model if admin has selected one that's different from document type default
      if (isAdmin && overrideModel && overrideModel !== (documentType.modelName || DEFAULT_MODEL)) {
        formData.append('model', overrideModel)
      }

      const result = await processDocument(formData)

      setFormData(result.data)
      const updatedDoc = {
        ...selectedDocument,
        extractedData: result.data,
        status: 'processed' as const,
      }
      setSelectedDocument(updatedDoc)
      setDocuments(documents.map((d) => (d.id === selectedDocument.id ? updatedDoc : d)))

      toast.success('Document processed by AI.')
    } catch (error: any) {
      toast.error(`Processing Error: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
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
          <Button
            onClick={handleAiProcessing}
            disabled={isProcessing || !selectedDocument}
            variant="outline"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bot className="h-4 w-4" />
            )}
            Process
          </Button>
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
                    <FormRenderer
                      key={selectedDocument.id}
                      schema={selectedDocument.schemaSnapshot || documentType.schema}
                      data={formData || {}}
                      onChange={handleDataChange}
                    />
                  </TabsContent>
                  <TabsContent value="data" className="m-0 h-full">
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
