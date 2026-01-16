import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useDocumentTypes } from '@/lib/queries'

// Document type card with distinctive styling
function DocumentTypeCard({
  docType,
}: {
  docType: {
    id: string
    name: string
    slug: string
    documentCount: number
    modelName: string | null
    createdAt: string
  }
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: `oklch(0.5 0.15 ${hue})` }}
            >
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              <path d="M10 9H8" />
              <path d="M16 13H8" />
              <path d="M16 17H8" />
            </svg>
          </div>
          <h3 className="font-sans text-lg font-semibold tracking-tight">
            {docType.name}
          </h3>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Created {new Date(docType.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>

      <p className="text-sm text-muted-foreground mb-6">
        {docType.documentCount} {docType.documentCount === 1 ? 'Document' : 'Documents'}
      </p>

      <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/50">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/document-types/$slug/settings" params={{ slug: docType.slug }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1.5"
            >
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
            Edit
          </Link>
        </Button>
        <Button size="sm" asChild>
          <Link to="/document-types/$slug" params={{ slug: docType.slug }}>
            Process
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ml-1.5"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
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
      <div className="w-24 h-24 mb-6 relative">
        {/* Stylized empty folder illustration */}
        <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect
            x="8"
            y="24"
            width="80"
            height="56"
            rx="4"
            className="fill-muted stroke-border"
            strokeWidth="2"
          />
          <path
            d="M8 32C8 29.7909 9.79086 28 12 28H36L44 20H84C86.2091 20 88 21.7909 88 24V28H8V32Z"
            className="fill-muted stroke-border"
            strokeWidth="2"
          />
          <circle cx="48" cy="52" r="12" className="fill-primary/10 stroke-primary" strokeWidth="2" />
          <path d="M48 46V58M42 52H54" className="stroke-primary" strokeWidth="2" strokeLinecap="round" />
        </svg>
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
          <div className="bg-muted rounded-xl h-[180px]" />
        </div>
      ))}
    </div>
  )
}

export default function DocumentTypesPage() {
  const { data: documentTypes, isLoading, error } = useDocumentTypes()

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-sans font-semibold tracking-tight">Document Types</h1>
          <p className="text-muted-foreground mt-1">
            Define schemas for extracting structured data from documents
          </p>
        </div>
        <Button asChild className="self-start">
          <Link to="/document-types/new" className="gap-2">
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
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Document Type
          </Link>
        </Button>
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
          {documentTypes?.map((docType, index) => (
            <DocumentTypeCard key={docType.id} docType={docType} index={index} />
          ))}
        </div>
      )}
    </div>
  )
}
