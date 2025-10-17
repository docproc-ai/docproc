import { notFound } from 'next/navigation'
import { getDocumentType } from '@/lib/actions/document-type'
import { getDocuments } from '@/lib/actions/document'
import { DocumentProcessor } from '@/components/document-processor'

// Force dynamic rendering for this page since we use searchParams
export const dynamic = 'force-dynamic'

export default async function ProcessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { id } = await params
  const documentTypeId = id
  const search = await searchParams

  // Parse search params
  const page = parseInt((search.page as string) || '1', 10)
  const pageSize = parseInt((search.pageSize as string) || '50', 10)
  const status = (search.status as 'pending' | 'processed' | 'approved' | 'all') || 'all'
  const searchQuery = (search.search as string) || undefined

  // Load both document type and documents server-side
  const [documentType, initialDocumentsResult] = await Promise.all([
    getDocumentType(documentTypeId),
    getDocuments(documentTypeId, {
      page,
      pageSize,
      status,
      search: searchQuery,
    }),
  ])

  if (!documentType) {
    notFound()
  }

  return (
    <div className="bg-background text-foreground h-screen">
      <DocumentProcessor
        documentType={{
          id: documentType.id,
          name: documentType.name,
          schema: documentType.schema,
          modelName: documentType.modelName,
        }}
        initialDocumentsResult={initialDocumentsResult}
      />
    </div>
  )
}
