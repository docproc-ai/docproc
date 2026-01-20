import {
  createRoute,
  Link,
  useParams,
  useNavigate,
} from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useDocument,
  useDocumentType,
  useUpdateDocument,
  useProcessDocument,
  useDeleteDocument,
} from '@/lib/queries'
import type { RootRoute } from '@tanstack/react-router'

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    processed:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    approved:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100'}`}
    >
      {status}
    </span>
  )
}

// Simple JSON form renderer
function JsonForm({
  schema,
  data,
  onChange,
}: {
  schema: Record<string, unknown>
  data: Record<string, unknown>
  onChange: (data: Record<string, unknown>) => void
}) {
  const properties =
    (schema.properties as Record<
      string,
      { type?: string; description?: string }
    >) || {}

  return (
    <div className="space-y-4">
      {Object.entries(properties).map(([key, prop]) => (
        <div key={key} className="space-y-1">
          <Label htmlFor={key}>
            {key}
            {prop.description && (
              <span className="text-muted-foreground font-normal ml-2 text-xs">
                ({prop.description})
              </span>
            )}
          </Label>
          <Input
            id={key}
            type={prop.type === 'number' ? 'number' : 'text'}
            value={String(data[key] ?? '')}
            onChange={(e) => {
              const value =
                prop.type === 'number' ? Number(e.target.value) : e.target.value
              onChange({ ...data, [key]: value })
            }}
          />
        </div>
      ))}
    </div>
  )
}

function DocumentDetailPage() {
  const { id } = useParams({ from: '/documents/$id' })
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
    const reason = prompt('Rejection reason:')
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
    if (confirm('Are you sure you want to delete this document?')) {
      await deleteDocument.mutateAsync(id)
      navigate({ to: '/document-types' })
    }
  }

  if (docLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="grid grid-cols-2 gap-6">
            <div className="h-96 bg-muted rounded-xl" />
            <div className="h-96 bg-muted rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-destructive/10 text-destructive rounded-md p-4">
          Document not found
        </div>
      </div>
    )
  }

  const schema = (document.schemaSnapshot || docType?.schema || {}) as Record<
    string,
    unknown
  >

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link to="/document-types" className="hover:text-foreground">
              Document Types
            </Link>
            <span>/</span>
            {docType && (
              <>
                <Link
                  to="/document-types/$slug"
                  params={{ slug: docType.slug }}
                  className="hover:text-foreground"
                >
                  {docType.name}
                </Link>
                <span>/</span>
              </>
            )}
            <span>{document.filename}</span>
          </div>
          <h1 className="text-2xl font-bold">{document.filename}</h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={document.status || 'pending'} />
            <span className="text-sm text-muted-foreground">
              {document.createdAt
                ? new Date(document.createdAt).toLocaleDateString()
                : ''}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Document Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Document Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg aspect-[3/4] flex items-center justify-center">
              {document.filename.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={`/api/documents/${document.id}/file`}
                  className="w-full h-full rounded-lg"
                  title="Document preview"
                />
              ) : (
                <img
                  src={`/api/documents/${document.id}/file`}
                  alt={document.filename}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Extracted Data Editor */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Extracted Data</CardTitle>
            {document.status === 'pending' && (
              <Button
                onClick={handleProcess}
                disabled={processDocument.isPending}
              >
                {processDocument.isPending
                  ? 'Processing...'
                  : 'Process Document'}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {document.status === 'pending' && !document.extractedData ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Document has not been processed yet</p>
                <Button
                  className="mt-4"
                  onClick={handleProcess}
                  disabled={processDocument.isPending}
                >
                  Process Now
                </Button>
              </div>
            ) : (
              <>
                <JsonForm
                  schema={schema}
                  data={editedData}
                  onChange={handleDataChange}
                />

                {document.rejectionReason && (
                  <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                    <strong>Rejection reason:</strong>{' '}
                    {document.rejectionReason}
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={handleSave}
                    disabled={!hasChanges || updateDocument.isPending}
                  >
                    Save Changes
                  </Button>
                  {(document.status === 'processed' ||
                    document.status === 'pending') && (
                    <>
                      <Button
                        variant="outline"
                        onClick={handleApprove}
                        disabled={updateDocument.isPending}
                        className="text-green-600 hover:text-green-700"
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleReject}
                        disabled={updateDocument.isPending}
                        className="text-red-600 hover:text-red-700"
                      >
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function createDocumentDetailRoute(rootRoute: RootRoute) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path: '/documents/$id',
    component: DocumentDetailPage,
  })
}
