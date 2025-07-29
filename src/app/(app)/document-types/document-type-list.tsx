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
import { getDocumentTypes } from '@/lib/actions/document-type'
import { authClient } from '@/lib/auth-client'
import { useEffect, useState } from 'react'
import { DocumentTypeCardSkeleton } from '@/components/ui/loading-skeletons'

export default function DocumentTypeList() {
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

  const canListDocumentTypes = authClient.admin.checkRolePermission({
    permissions: { documentType: ['list'] },
    role: (session?.user?.role as any) || 'none',
  })

  const canCreateDocumentTypes = authClient.admin.checkRolePermission({
    permissions: { documentType: ['create'] },
    role: (session?.user?.role as any) || 'none',
  })

  const canUpdateDocumentTypes = authClient.admin.checkRolePermission({
    permissions: { documentType: ['update'] },
    role: (session?.user?.role as any) || 'none',
  })

  return (
    <>
      {isLoading ? (
        <DocumentTypeCardSkeleton count={6} />
      ) : documentTypes.length === 0 ? (
        <div className="border-border rounded-lg border-2 border-dashed py-16 text-center">
          <h2 className="text-2xl font-semibold">No Document Types Found</h2>
          <p className="text-muted-foreground mt-2">
            {canCreateDocumentTypes
              ? 'Get started by creating your first document type.'
              : 'No document types have been created yet. Contact an admin to create document types.'}
          </p>
          {canCreateDocumentTypes && (
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
                <div className="text-muted-foreground text-sm">{type.document_count} Documents</div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                {canUpdateDocumentTypes && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/document-types/${type.id}/edit`}>
                      <Edit className="h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/document-types/${type.id}/process`}>
                    Process <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
