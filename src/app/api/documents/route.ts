import { NextResponse } from 'next/server'
import { getDocuments } from '@/lib/actions/document'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const documentTypeId = searchParams.get('documentTypeId')

  if (!documentTypeId) {
    return NextResponse.json({ error: 'documentTypeId is required' }, { status: 400 })
  }

  try {
    const documents = await getDocuments(parseInt(documentTypeId))
    
    // Return simplified data for external API consumers
    const simplifiedDocs = documents.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      documentTypeId: doc.documentTypeId,
      approvalStatus: doc.approvalStatus,
      processingStatus: doc.processingStatus,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }))
    
    return NextResponse.json(simplifiedDocs)
  } catch (error) {
    console.error('Failed to fetch documents:', error)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}
