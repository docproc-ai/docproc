import { notFound } from 'next/navigation'
import { getDocumentType } from '@/lib/filesystem'
import { DocumentProcessor } from '@/components/document-processor'

export default async function ProcessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const documentType = await getDocumentType(id)

  if (!documentType) {
    notFound()
  }

  return (
    <div className="bg-background text-foreground h-screen">
      <DocumentProcessor documentType={documentType} />
    </div>
  )
}
