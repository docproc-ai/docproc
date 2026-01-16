import { createRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDocumentTypes } from '@/lib/queries'
import type { RootRoute } from '@tanstack/react-router'

function DocumentTypesPage() {
  const { data: documentTypes, isLoading, error } = useDocumentTypes()

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-destructive/10 text-destructive rounded-md p-4">
          Failed to load document types
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Document Types</h1>
          <p className="text-muted-foreground">Manage your document extraction schemas</p>
        </div>
        <Button asChild>
          <Link to="/document-types/new">Create New</Link>
        </Button>
      </div>

      {documentTypes && documentTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No document types yet</p>
            <Button asChild>
              <Link to="/document-types/new">Create your first document type</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documentTypes?.map((docType) => (
            <Link
              key={docType.id}
              to="/document-types/$slug"
              params={{ slug: docType.slug }}
              className="block"
            >
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <CardTitle>{docType.name}</CardTitle>
                  <CardDescription>{docType.slug}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Documents</span>
                    <span className="font-medium">{docType.documentCount}</span>
                  </div>
                  {docType.modelName && (
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-muted-foreground">Model</span>
                      <span className="font-mono text-xs truncate max-w-[150px]">
                        {docType.modelName}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function createDocumentTypesRoute(rootRoute: RootRoute) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path: '/document-types',
    component: DocumentTypesPage,
  })
}
