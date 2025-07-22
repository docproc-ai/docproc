import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { FileText, ArrowRight, Edit } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { SettingsDialog } from "@/components/settings-dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { getDocumentTypes } from "@/lib/filesystem"

// This line forces the page to be rendered dynamically on every request.
export const dynamic = "force-dynamic"

export default async function DocumentTypesPage() {
  const documentTypes = await getDocumentTypes()

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0">
        <h1 className="text-xl font-semibold">Document Types</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/document-types/new">New Document Type</Link>
          </Button>
          <SettingsDialog />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-grow overflow-auto p-6">
        <div className="space-y-6">
          {documentTypes.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
              <h2 className="text-2xl font-semibold">No Document Types Found</h2>
              <p className="text-muted-foreground mt-2">Get started by creating your first document type.</p>
              <Button asChild className="mt-4">
                <Link href="/document-types/new">Create Document Type</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documentTypes.map((type) => (
                <Card key={type.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      {type.name}
                    </CardTitle>
                    <CardDescription>
                      Created {formatDistanceToNow(new Date(type.created_at), { addSuffix: true })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <div className="text-sm text-muted-foreground">{type.document_count} Documents</div>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/document-types/edit/${type.id}`}>
                        <Edit className="w-4 h-4" />
                        Edit
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/process/${type.id}`}>
                        Process <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
