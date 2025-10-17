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
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
    const status = (searchParams.get('status') || 'all') as 'pending' | 'processed' | 'approved' | 'all'
    const search = searchParams.get('search') || undefined

    if (!documentTypeId) {
      return NextResponse.json({ error: 'documentTypeId is required' }, { status: 400 })
    }

    // Validate pagination params
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return NextResponse.json({ error: 'Invalid pagination parameters' }, { status: 400 })
    }

    const result = await getDocuments(documentTypeId, {
      page,
      pageSize,
      status,
      search,
    })

    // Return simplified data for external API consumers
    const simplifiedDocs = result.documents.map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      documentTypeId: doc.documentTypeId,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }))

    return NextResponse.json({
      documents: simplifiedDocs,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    })
  } catch (error) {
    console.error('Failed to fetch documents:', error)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}
