import { NextResponse } from 'next/server'
import {
  getDocumentType,
  updateDocumentType,
  deleteDocumentType,
} from '@/lib/actions/document-type'
import { checkApiAuth } from '@/lib/api-auth'

// GET a single document type by ID
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check if user has permission to list document types (or has valid API key)
    const authCheck = await checkApiAuth({
      documentType: ['list']
    });

    if (!authCheck.success) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params
    const docType = await getDocumentType(id)

    if (!docType) {
      return NextResponse.json({ error: 'Document type not found' }, { status: 404 })
    }

    return NextResponse.json(docType)
  } catch (error) {
    console.error('Failed to fetch document type:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT (update) a document type by ID
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check if user has permission to update document types (or has valid API key)
    const authCheck = await checkApiAuth({
      documentType: ['update']
    });

    if (!authCheck.success) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params
    const body = await request.json()

    if (!body.name || !body.schema) {
      return NextResponse.json({ error: 'Name and schema are required' }, { status: 400 })
    }

    // Convert JSON body to FormData for server action
    const formData = new FormData()
    formData.append('name', body.name)
    formData.append('schema', JSON.stringify(body.schema))
    formData.append('webhookUrl', body.webhookUrl || '')
    formData.append('webhookMethod', body.webhookMethod || 'POST')

    const result = await updateDocumentType(id, formData)

    if (!result.success) {
      const errorMessage = 'error' in result ? result.error : 'Failed to update document type'
      if (errorMessage === 'Admin access required') {
        return NextResponse.json({ error: errorMessage }, { status: 403 })
      }
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    return NextResponse.json('data' in result ? result.data : {}, { status: 200 })
  } catch (error: any) {
    console.error('Failed to update document type:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE a document type and all its associated documents/files
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check if user has permission to delete document types (or has valid API key)
    const authCheck = await checkApiAuth({
      documentType: ['delete']
    });

    if (!authCheck.success) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Document Type ID is required' }, { status: 400 })
    }

    await deleteDocumentType(id)

    return NextResponse.json(
      { message: 'Document type and all associated documents deleted successfully.' },
      { status: 200 },
    )
  } catch (error: any) {
    console.error(`Failed to delete document type:`, error)

    if (error.message === 'Admin access required') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
