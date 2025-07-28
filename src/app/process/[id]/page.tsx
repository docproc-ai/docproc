import { notFound } from 'next/navigation'
import { getDocumentType } from '@/lib/actions/document-type'
import { getDocuments } from '@/lib/actions/document'
import { DocumentProcessor } from '@/components/document-processor'

export default async function ProcessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const documentTypeId = parseInt(id)

  // Load both document type and documents server-side
  const [documentType, initialDocuments] = await Promise.all([
    getDocumentType(documentTypeId),
    getDocuments(documentTypeId),
  ])

  if (!documentType) {
    notFound()
  }

  return (
    <div className="bg-background text-foreground h-screen">
      <DocumentProcessor
        documentType={{
          id: documentType.id.toString(),
          name: documentType.name,
          schema: documentType.schema,
          modelName: documentType.modelName,
        }}
        initialDocuments={initialDocuments}
      />
    </div>
  )
}
