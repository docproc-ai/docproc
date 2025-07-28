'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { FileText, ArrowRight, Edit } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { SettingsDialog } from '@/components/settings-dialog'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'
import { getDocumentTypes } from '@/lib/actions/document-type'
import { authClient } from '@/lib/auth-client'
import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { PageLoadingSkeleton, DocumentTypeCardSkeleton } from '@/components/ui/loading-skeletons'

export default function DocumentTypesPage() {
  const [documentTypes, setDocumentTypes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { data: session } = authClient.useSession()

  useEffect(() => {
    const loadDocumentTypes = async () => {
      try {
        const types = await getDocumentTypes()
        setDocumentTypes(types)
      } catch (error) {
        console.error('Error loading document types:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadDocumentTypes()
  }, [])

  return (
    <div className="bg-background text-foreground flex h-screen flex-col">
      <header className="border-border flex flex-shrink-0 items-center justify-between border-b px-6 py-3">
        <h1 className="text-xl font-semibold">Document Types</h1>
        <div className="flex items-center gap-2">
          {session?.user?.role === 'admin' && (
            <>
              <Button variant="outline" asChild>
                <Link href="/document-types/new">New Document Type</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/users">
                  <Users className="h-4 w-4" />
                  Manage Users
                </Link>
              </Button>
            </>
          )}
          <SettingsDialog />
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>
      <main className="flex-grow overflow-auto p-6">
        <div className="space-y-6">
          {isLoading ? (
            <DocumentTypeCardSkeleton count={6} />
          ) : documentTypes.length === 0 ? (
            <div className="border-border rounded-lg border-2 border-dashed py-16 text-center">
              <h2 className="text-2xl font-semibold">No Document Types Found</h2>
              <p className="text-muted-foreground mt-2">
                {session?.user?.role === 'admin'
                  ? 'Get started by creating your first document type.'
                  : 'No document types have been created yet. Contact an admin to create document types.'}
              </p>
              {session?.user?.role === 'admin' && (
                <Button asChild className="mt-4">
                  <Link href="/document-types/new">Create Document Type</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {documentTypes.map((type) => (
                <Card key={type.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="text-muted-foreground h-5 w-5" />
                      {type.name}
                    </CardTitle>
                    <CardDescription>
                      Created{' '}
                      {type.createdAt
                        ? formatDistanceToNow(new Date(type.createdAt), { addSuffix: true })
                        : 'Unknown'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <div className="text-muted-foreground text-sm">
                      {type.document_count} Documents
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-2">
                    {session?.user?.role === 'admin' && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/document-types/edit/${type.id}`}>
                          <Edit className="h-4 w-4" />
                          Edit
                        </Link>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/process/${type.id}`}>
                        Process <ArrowRight className="h-4 w-4" />
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
