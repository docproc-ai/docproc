import { NextResponse } from 'next/server'
import { getDocuments } from '@/lib/actions/document'
import { checkApiAuth } from '@/lib/api-auth'

export async function GET(request: Request) {
  try {
    // Check if user has permission to list documents (or has valid API key)
    const authCheck = await checkApiAuth({
      document: ['list']
    });

    if (!authCheck.success) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url)
    const documentTypeId = searchParams.get('documentTypeId')

    if (!documentTypeId) {
      return NextResponse.json({ error: 'documentTypeId is required' }, { status: 400 })
    }

    const documents = await getDocuments(documentTypeId)

    // Return simplified data for external API consumers
    const simplifiedDocs = documents.map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      documentTypeId: doc.documentTypeId,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }))

    return NextResponse.json(simplifiedDocs)
  } catch (error) {
    console.error('Failed to fetch documents:', error)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}
