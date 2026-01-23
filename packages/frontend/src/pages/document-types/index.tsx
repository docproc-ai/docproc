import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  File,
  FileCheck,
  FileClock,
  FileText,
  FileX,
  FolderPlus,
  Pencil,
  Plus,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { authClient, useSession } from '@/lib/auth'
import { PermissionError, useDocumentTypes } from '@/lib/queries'

// Document type card with distinctive styling
function DocumentTypeCard({
  docType,
  canEdit,
  canProcess,
}: {
  docType: {
    id: string
    name: string
    slug: string
    statusCounts: {
      pending: number
      processed: number
      approved: number
      rejected: number
    }
  }
  canEdit: boolean
  canProcess: boolean
}) {
  // Generate a subtle accent color based on the slug
  const hue =
    docType.slug.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) %
    360

  return (
    <Card className="group gap-4 py-4 hover:border-primary/30 transition-colors">
      <CardHeader className="flex flex-row items-center gap-3 py-0 h-12">
        <div
          className="size-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `oklch(0.95 0.03 ${hue})` }}
        >
          <FileText
            className="size-5"
            strokeWidth={1.5}
            style={{ color: `oklch(0.5 0.15 ${hue})` }}
          />
        </div>
        <CardTitle className="text-lg line-clamp-2">{docType.name}</CardTitle>
      </CardHeader>

      <CardContent className="mt-auto flex items-center justify-between py-0">
        <div
          className="flex items-center gap-1 text-muted-foreground"
          title="Pending"
        >
          <File className="size-4" />
          <span className="text-sm">{docType.statusCounts.pending}</span>
        </div>
        <div
          className="flex items-center gap-1 text-blue-500"
          title="Ready for review"
        >
          <FileClock className="size-4" />
          <span className="text-sm">{docType.statusCounts.processed}</span>
        </div>
        <div
          className="flex items-center gap-1 text-green-500"
          title="Approved"
        >
          <FileCheck className="size-4" />
          <span className="text-sm">{docType.statusCounts.approved}</span>
        </div>
        <div className="flex items-center gap-1 text-red-500" title="Rejected">
          <FileX className="size-4" />
          <span className="text-sm">{docType.statusCounts.rejected}</span>
        </div>
      </CardContent>

      <CardFooter className="justify-end border-t pt-4">
        {canEdit && (
          <Button variant="ghost" size="sm" asChild>
            <Link
              to="/document-types/$slug/settings"
              params={{ slug: docType.slug }}
            >
              <Pencil className="size-3.5" />
              Edit
            </Link>
          </Button>
        )}
        {canProcess && (
          <Button size="sm" asChild>
            <Link
              to="/document-types/$slug/process"
              params={{ slug: docType.slug }}
            >
              Process
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

// Empty state with illustration
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-24 h-24 mb-6 flex items-center justify-center">
        <FolderPlus className="size-16 text-muted-foreground" />
      </div>
      <h3 className="font-sans text-xl font-semibold mb-2">
        No document types yet
      </h3>
      <p className="text-muted-foreground text-center max-w-sm mb-6">
        Create your first document type to start extracting structured data from
        your documents.
      </p>
      <Button asChild>
        <Link to="/document-types/new">Create Document Type</Link>
      </Button>
    </div>
  )
}

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse">
          <div className="bg-muted rounded-xl h-[160px]" />
        </div>
      ))}
    </div>
  )
}

export default function DocumentTypesPage() {
  const [search, setSearch] = useState('')
  const { data: documentTypes, isLoading, error } = useDocumentTypes()
  const { data: session } = useSession()
  const userRole =
    (session?.user as { role?: string } | undefined)?.role || 'none'

  const canCreateDocumentTypes = authClient.admin.checkRolePermission({
    permissions: { documentType: ['create'] },
    role: userRole as 'admin' | 'user' | 'none',
  })

  const canUpdateDocumentTypes = authClient.admin.checkRolePermission({
    permissions: { documentType: ['update'] },
    role: userRole as 'admin' | 'user' | 'none',
  })

  const canListDocuments = authClient.admin.checkRolePermission({
    permissions: { document: ['list'] },
    role: userRole as 'admin' | 'user' | 'none',
  })

  const filteredDocumentTypes = useMemo(() => {
    if (!documentTypes || !search.trim()) return documentTypes
    const searchLower = search.toLowerCase()
    return documentTypes.filter(
      (docType) =>
        docType.name.toLowerCase().includes(searchLower) ||
        docType.slug.toLowerCase().includes(searchLower),
    )
  }, [documentTypes, search])

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-sans font-semibold tracking-tight">
            Document Types
          </h1>
        </div>
        {canCreateDocumentTypes && (
          <Button asChild className="self-start">
            <Link to="/document-types/new" className="gap-2">
              <Plus className="size-4" />
              New Document Type
            </Link>
          </Button>
        )}
      </div>

      {/* Search */}
      {documentTypes && documentTypes.length > 0 && (
        <div className="mb-6">
          <Input
            placeholder="Search document types..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : error instanceof PermissionError ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-24 h-24 mb-6 flex items-center justify-center rounded-full bg-muted">
            <FileText className="size-12 text-muted-foreground" />
          </div>
          <h3 className="font-sans text-xl font-semibold mb-2">No Access</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            You don't have permission to view document types. Contact an
            administrator to request access.
          </p>
        </div>
      ) : error ? (
        <div className="bg-destructive/10 text-destructive rounded-lg p-6">
          <h3 className="font-medium mb-1">Failed to load document types</h3>
          <p className="text-sm opacity-80">Please try refreshing the page.</p>
        </div>
      ) : documentTypes && documentTypes.length === 0 ? (
        <EmptyState />
      ) : filteredDocumentTypes && filteredDocumentTypes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-24 h-24 mb-6 flex items-center justify-center">
            <FileText className="size-16 text-muted-foreground" />
          </div>
          <h3 className="font-sans text-xl font-semibold mb-2">
            No results found
          </h3>
          <p className="text-muted-foreground text-center max-w-sm">
            No document types match "{search}". Try a different search term.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredDocumentTypes?.map((docType) => (
            <DocumentTypeCard
              key={docType.id}
              docType={docType}
              canEdit={canUpdateDocumentTypes}
              canProcess={canListDocuments}
            />
          ))}
        </div>
      )}
    </div>
  )
}
