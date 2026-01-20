import { Link } from '@tanstack/react-router'
import { ArrowRight, File, FileCheck, FileClock, FileText, FileX, FolderPlus, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDocumentTypes } from '@/lib/queries'
import { useSession } from '@/lib/auth'

// Document type card with distinctive styling
function DocumentTypeCard({
  docType,
  isAdmin,
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
  isAdmin: boolean
}) {
  // Generate a subtle accent color based on the slug
  const hue = docType.slug.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360

  return (
    <div className="group relative bg-card border rounded-xl p-6 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `oklch(0.95 0.03 ${hue})` }}
          >
            <FileText
              className="size-5"
              strokeWidth={1.5}
              style={{ color: `oklch(0.5 0.15 ${hue})` }}
            />
          </div>
          <h3 className="font-sans text-lg font-semibold tracking-tight">
            {docType.name}
          </h3>
        </div>
      </div>

      {/* Status chips */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-1 text-muted-foreground" title="Pending">
          <File className="size-4" />
          <span className="text-sm">{docType.statusCounts.pending}</span>
        </div>
        <div className="flex items-center gap-1 text-blue-500" title="Ready for review">
          <FileClock className="size-4" />
          <span className="text-sm">{docType.statusCounts.processed}</span>
        </div>
        <div className="flex items-center gap-1 text-green-500" title="Approved">
          <FileCheck className="size-4" />
          <span className="text-sm">{docType.statusCounts.approved}</span>
        </div>
        <div className="flex items-center gap-1 text-red-500" title="Rejected">
          <FileX className="size-4" />
          <span className="text-sm">{docType.statusCounts.rejected}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/50">
        {isAdmin && (
          <Button variant="ghost" size="sm" asChild>
            <Link to="/document-types/$slug/settings" params={{ slug: docType.slug }}>
              <Pencil className="size-3.5 mr-1.5" />
              Edit
            </Link>
          </Button>
        )}
        <Button size="sm" asChild>
          <Link to="/document-types/$slug/process" params={{ slug: docType.slug }}>
            Process
            <ArrowRight className="size-3.5 ml-1.5" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

// Empty state with illustration
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-24 h-24 mb-6 flex items-center justify-center">
        <FolderPlus className="size-16 text-muted-foreground" />
      </div>
      <h3 className="font-sans text-xl font-semibold mb-2">No document types yet</h3>
      <p className="text-muted-foreground text-center max-w-sm mb-6">
        Create your first document type to start extracting structured data from your documents.
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
  const { data: documentTypes, isLoading, error } = useDocumentTypes()
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin'

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-sans font-semibold tracking-tight">Document Types</h1>
        </div>
        {isAdmin && (
          <Button asChild className="self-start">
            <Link to="/document-types/new" className="gap-2">
              <Plus className="size-4" />
              New Document Type
            </Link>
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="bg-destructive/10 text-destructive rounded-lg p-6">
          <h3 className="font-medium mb-1">Failed to load document types</h3>
          <p className="text-sm opacity-80">Please try refreshing the page.</p>
        </div>
      ) : documentTypes && documentTypes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {documentTypes?.map((docType) => (
            <DocumentTypeCard key={docType.id} docType={docType} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  )
}
