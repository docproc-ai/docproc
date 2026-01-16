import { Link, useParams, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  useDocument,
  useDocumentType,
  useUpdateDocument,
  useProcessDocument,
  useDeleteDocument,
} from '@/lib/queries'
import { FormRenderer } from '@/components/form-renderer'
import type { JsonSchema } from '@/components/schema-builder/types'

// Status badge with semantic colors
function StatusBadge({ status }: { status: string }) {
  const statusClasses: Record<string, string> = {
    pending: 'status-pending',
    processed: 'status-processed',
    approved: 'status-approved',
    rejected: 'status-rejected',
  }

  const icons: Record<string, JSX.Element> = {
    pending: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    processed: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    approved: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    rejected: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium capitalize ${
        statusClasses[status] || 'bg-muted text-muted-foreground'
      }`}
    >
      {icons[status]}
      {status}
    </span>
  )
}


// Document preview panel
function DocumentPreview({ document }: { document: { id: string; filename: string } }) {
  const isPdf = document.filename.toLowerCase().endsWith('.pdf')

  return (
    <div className="relative bg-muted rounded-xl overflow-hidden aspect-[3/4]">
      {isPdf ? (
        <iframe
          src={`/api/documents/${document.id}/file`}
          className="w-full h-full"
          title="Document preview"
        />
      ) : (
        <img
          src={`/api/documents/${document.id}/file`}
          alt={document.filename}
          className="w-full h-full object-contain"
        />
      )}
    </div>
  )
}

export default function DocumentDetailPage() {
  const params = useParams({ strict: false })
  const id = params.id as string
  const navigate = useNavigate()
  const [editedData, setEditedData] = useState<Record<string, unknown>>({})
  const [hasChanges, setHasChanges] = useState(false)

  const { data: document, isLoading: docLoading } = useDocument(id)
  const { data: docType } = useDocumentType(document?.documentTypeId || '')
  const updateDocument = useUpdateDocument()
  const processDocument = useProcessDocument()
  const deleteDocument = useDeleteDocument()

  // Initialize edited data when document loads
  useEffect(() => {
    if (document?.extractedData) {
      setEditedData(document.extractedData as Record<string, unknown>)
    }
  }, [document?.extractedData])

  const handleDataChange = (data: Record<string, unknown>) => {
    setEditedData(data)
    setHasChanges(true)
  }

  const handleSave = async () => {
    await updateDocument.mutateAsync({
      id,
      data: { extractedData: editedData },
    })
    setHasChanges(false)
  }

  const handleApprove = async () => {
    await updateDocument.mutateAsync({
      id,
      data: { status: 'approved', extractedData: editedData },
    })
    setHasChanges(false)
  }

  const handleReject = async () => {
    const reason = prompt('Please provide a rejection reason:')
    if (reason) {
      await updateDocument.mutateAsync({
        id,
        data: { status: 'rejected', rejectionReason: reason },
      })
    }
  }

  const handleProcess = async () => {
    await processDocument.mutateAsync({ documentId: id })
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      await deleteDocument.mutateAsync(id)
      navigate({ to: '/document-types' })
    }
  }

  if (docLoading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="aspect-[3/4] bg-muted rounded-xl" />
            <div className="space-y-4">
              <div className="h-8 bg-muted rounded w-1/2" />
              <div className="h-40 bg-muted rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="bg-destructive/10 text-destructive rounded-lg p-6">
          <h3 className="font-medium mb-1">Document not found</h3>
          <p className="text-sm opacity-80">The document you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  const schema = (document.schemaSnapshot || docType?.schema || {}) as JsonSchema

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/document-types" className="hover:text-foreground transition-colors">
          Document Types
        </Link>
        <span className="text-muted-foreground/50">/</span>
        {docType && (
          <>
            <Link
              to="/document-types/$slug"
              params={{ slug: docType.slug }}
              className="hover:text-foreground transition-colors"
            >
              {docType.name}
            </Link>
            <span className="text-muted-foreground/50">/</span>
          </>
        )}
        <span className="text-foreground truncate max-w-[200px]">{document.filename}</span>
      </div>

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-sans font-semibold tracking-tight mb-2">
            {document.filename}
          </h1>
          <div className="flex items-center gap-3">
            <StatusBadge status={document.status || 'pending'} />
            <span className="text-sm text-muted-foreground">
              {document.createdAt
                ? new Date(document.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : ''}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
          Delete
        </Button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Document Preview */}
        <div className="">
          <h2 className="font-sans text-lg font-semibold mb-4">Preview</h2>
          <DocumentPreview document={document} />
        </div>

        {/* Extracted Data Editor */}
        <div className="">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans text-lg font-semibold">Extracted Data</h2>
            {document.status === 'pending' && (
              <Button onClick={handleProcess} disabled={processDocument.isPending} size="sm">
                {processDocument.isPending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Processing...
                  </>
                ) : (
                  'Process Document'
                )}
              </Button>
            )}
          </div>

          <div className="bg-card border rounded-xl p-6">
            {document.status === 'pending' && !document.extractedData ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-muted-foreground"
                  >
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                </div>
                <h3 className="font-medium mb-2">Document not processed</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Process this document to extract structured data using AI.
                </p>
                <Button onClick={handleProcess} disabled={processDocument.isPending}>
                  Process Now
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <FormRenderer schema={schema} data={editedData} onChange={handleDataChange} />

                {document.rejectionReason && (
                  <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
                    <div className="flex items-start gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mt-0.5 flex-shrink-0"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <div>
                        <p className="font-medium mb-1">Rejection Reason</p>
                        <p>{document.rejectionReason}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-4 border-t">
                  <Button onClick={handleSave} disabled={!hasChanges || updateDocument.isPending}>
                    {updateDocument.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>

                  {(document.status === 'processed' || document.status === 'pending') && (
                    <>
                      <Button
                        variant="outline"
                        onClick={handleApprove}
                        disabled={updateDocument.isPending}
                        className="border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mr-2"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleReject}
                        disabled={updateDocument.isPending}
                        className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mr-2"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
