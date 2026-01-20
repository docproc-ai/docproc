import { createRoute, Link, useParams } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  useDocumentType,
  useDocuments,
  useProcessDocument,
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

function DocumentTypeDetailPage() {
  const { slug } = useParams({ from: '/document-types/$slug' })
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const { data: docType, isLoading: typeLoading } = useDocumentType(slug)
  const {
    data: documentsData,
    isLoading: docsLoading,
    refetch,
  } = useDocuments(docType?.id || '', { page, status: statusFilter })

  const processDocument = useProcessDocument()

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0 || !docType) return

      const formData = new FormData()
      for (const file of files) {
        formData.append('files', file)
      }

      try {
        const res = await fetch(`/api/document-types/${docType.slug}/upload`, {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          refetch()
        }
      } catch (err) {
        console.error('Upload failed:', err)
      }

      // Reset input
      e.target.value = ''
    },
    [docType, refetch],
  )

  const handleProcess = async (documentId: string) => {
    await processDocument.mutateAsync({ documentId })
  }

  if (typeLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-40 bg-muted rounded-xl" />
        </div>
      </div>
    )
  }

  if (!docType) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-destructive/10 text-destructive rounded-md p-4">
          Document type not found
        </div>
      </div>
    )
  }

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
            <span>{docType.name}</span>
          </div>
          <h1 className="text-2xl font-bold">{docType.name}</h1>
          <p className="text-muted-foreground">{docType.slug}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link
              to="/document-types/$slug/settings"
              params={{ slug: docType.slug }}
            >
              Settings
            </Link>
          </Button>
          <label>
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.tiff"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button asChild>
              <span>Upload Documents</span>
            </Button>
          </label>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'pending', 'processed', 'approved', 'rejected'].map(
          (status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setStatusFilter(status)
                setPage(1)
              }}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ),
        )}
      </div>

      {/* Documents List */}
      {docsLoading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded" />
          ))}
        </div>
      ) : documentsData?.documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No documents yet</p>
            <label>
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.tiff"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button asChild>
                <span>Upload your first document</span>
              </Button>
            </label>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {documentsData?.documents.map((doc) => (
            <Card
              key={doc.id}
              className="hover:border-primary/50 transition-colors"
            >
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-muted rounded flex items-center justify-center text-xs font-mono">
                    {doc.filename.split('.').pop()?.toUpperCase()}
                  </div>
                  <div>
                    <Link
                      to="/documents/$id"
                      params={{ id: doc.id }}
                      className="font-medium hover:underline"
                    >
                      {doc.filename}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {new Date(doc.createdAt!).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={doc.status || 'pending'} />
                  {doc.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleProcess(doc.id)}
                      disabled={processDocument.isPending}
                    >
                      Process
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/documents/$id" params={{ id: doc.id }}>
                      View
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {documentsData?.pagination &&
            documentsData.pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {documentsData.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === documentsData.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
        </div>
      )}
    </div>
  )
}

export default function createDocumentTypeDetailRoute(rootRoute: RootRoute) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path: '/document-types/$slug',
    component: DocumentTypeDetailPage,
  })
}
