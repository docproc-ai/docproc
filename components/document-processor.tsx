'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { DocumentQueue } from '@/components/document-queue'
import DocumentViewer from '@/components/document-viewer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataEditorTab } from './editor-tabs'
import { FormRenderer } from './form-renderer'
import { useToast } from './ui/use-toast'
import { Bot, Loader2, CheckCircle, ArrowLeft, Undo2 } from 'lucide-react'
import { Button } from './ui/button'
import { useSettings } from '@/hooks/use-settings'
import { SettingsDialog } from './settings-dialog'
import { ThemeToggle } from './theme-toggle'

// Define the shape of a document object
export interface Document {
  id: string
  original_filename: string
  status: 'pending' | 'approved' | 'rejected' | 'processing_failed'
  uploaded_at: string
  storage_path: string
  extracted_data: any
  schema_snapshot: any
}

interface DocumentProcessorProps {
  documentType: {
    id: string
    name: string
    schema: any
  }
}

export function DocumentProcessor({ documentType }: DocumentProcessorProps) {
  const { toast } = useToast()
  const { model } = useSettings()
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [formData, setFormData] = useState<any>(null)
  const [viewerFile, setViewerFile] = useState<{ name: string; url: string; type: string } | null>(
    null,
  )
  const [activeTab, setActiveTab] = useState('form')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const viewerRef = useRef<any>(null)
  const [currentPageImageData, setCurrentPageImageData] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch(`/api/documents?documentTypeId=${documentType.id}`)
      if (!response.ok) throw new Error('Failed to fetch documents')
      const data = await response.json()
      setDocuments(data)
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch documents.' })
    }
  }, [documentType.id, toast])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleDocumentSelect = (doc: Document | null) => {
    setSelectedDocument(doc)
    setFormData(doc?.extracted_data || {})
    if (doc) {
      // Create a URL with the document type ID as a query parameter for the file endpoint
      const fileUrl = `/api/documents/${doc.id}/file?documentTypeId=${documentType.id}`
      setViewerFile({
        name: doc.original_filename,
        url: fileUrl,
        type: doc.original_filename.endsWith('.pdf') ? 'application/pdf' : 'image/png',
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
      toast({ variant: 'destructive', title: 'Error', description: 'No document selected.' })
      return
    }

    setIsProcessing(true)
    try {
      const response = await fetch(`/api/process-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentTypeId: documentType.id,
          documentId: selectedDocument.id,
          schema: selectedDocument.schema_snapshot || documentType.schema,
          model: model,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Processing failed')

      setFormData(result.data)
      const updatedDoc = {
        ...selectedDocument,
        extracted_data: result.data,
        status: 'pending' as const,
      }
      setSelectedDocument(updatedDoc)
      setDocuments(documents.map((d) => (d.id === selectedDocument.id ? updatedDoc : d)))

      toast({ title: 'Success', description: 'Document processed by AI.' })
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Processing Error', description: error.message })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleStatusUpdate = async (status: 'approved' | 'pending') => {
    if (!selectedDocument) return
    setIsSaving(true)
    try {
      const body: any = {
        extracted_data: formData,
        status: status,
      }
      if (status === 'approved') {
        body.schema_snapshot = documentType.schema
      }

      const response = await fetch(`/api/documents/${selectedDocument.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-document-type-id': documentType.id,
        },
        body: JSON.stringify(body),
      })

      const updatedDoc = await response.json()
      if (!response.ok) {
        throw new Error(
          updatedDoc.error ||
            `Failed to ${status === 'approved' ? 'approve' : 'unapprove'} document.`,
        )
      }

      setSelectedDocument(updatedDoc as Document)
      setDocuments(documents.map((d) => (d.id === updatedDoc.id ? (updatedDoc as Document) : d)))

      toast({
        title: status === 'approved' ? 'Approved!' : 'Status Updated',
        description: `Document "${updatedDoc.original_filename}" status set to ${status}.`,
      })
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Save Error',
        description: error.message,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (docId: string) => {
    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          'x-document-type-id': documentType.id,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete document.')
      }

      toast({ title: 'Success', description: 'Document deleted.' })

      // Update state
      setDocuments((docs) => docs.filter((d) => d.id !== docId))
      if (selectedDocument?.id === docId) {
        handleDocumentSelect(null)
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Delete Error', description: error.message })
    }
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
            {selectedDocument?.original_filename || 'No document selected'}
          </span>
        </h1>
        <div className="ml-auto flex items-center gap-2">
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
              onClick={() => handleStatusUpdate('pending')}
              disabled={isSaving || !selectedDocument}
              variant="secondary"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Undo2 className="h-4 w-4" />
              )}
              Unapprove
            </Button>
          ) : (
            <Button
              onClick={() => handleStatusUpdate('approved')}
              disabled={isSaving || !selectedDocument}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Approve
            </Button>
          )}
          <div className="border-border flex items-center gap-2 border-l pl-2">
            <SettingsDialog />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <ResizablePanelGroup direction="horizontal" className="flex-grow">
        <ResizablePanel defaultSize={20} minSize={15}>
          <DocumentQueue
            documentTypeId={documentType.id}
            documents={documents}
            selectedDocument={selectedDocument}
            onSelect={handleDocumentSelect}
            onUploadSuccess={fetchDocuments}
            onDelete={handleDelete}
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={45} minSize={30}>
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
                      schema={selectedDocument.schema_snapshot || documentType.schema}
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
        <ResizablePanel defaultSize={35} minSize={25}>
          <DocumentViewer file={viewerFile} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
