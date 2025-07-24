import { NextResponse } from 'next/server'
import { getDocument, updateDocument, deleteDocument } from '@/lib/actions/document'

// GET a single document by ID
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const document = await getDocument(parseInt(id))

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    
    // Return simplified data for external API consumers
    const simplifiedDoc = {
      id: document.id,
      filename: document.filename,
      documentTypeId: document.documentTypeId,
      approvalStatus: document.approvalStatus,
      processingStatus: document.processingStatus,
      extractedData: document.extractedData,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    }
    
    return NextResponse.json(simplifiedDoc)
  } catch (error) {
    console.error('Failed to fetch document:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT (update) a document by ID
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
  }

  try {
    const body = await request.json()

    // Convert JSON body to FormData for server action
    const formData = new FormData()
    
    if (body.extractedData) {
      formData.append('extractedData', JSON.stringify(body.extractedData))
    }
    
    if (body.approvalStatus) {
      formData.append('approvalStatus', body.approvalStatus)
    }
    
    if (body.processingStatus) {
      formData.append('processingStatus', body.processingStatus)
    }
    
    if (body.schemaSnapshot) {
      formData.append('schemaSnapshot', JSON.stringify(body.schemaSnapshot))
    }

    const updatedDocument = await updateDocument(parseInt(id), formData)

    return NextResponse.json(updatedDocument)
  } catch (error) {
    console.error(`Failed to update document ${id}:`, error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE a document by ID
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
  }

  try {
    await deleteDocument(parseInt(id))

    return NextResponse.json({ message: 'Document deleted successfully' }, { status: 200 })
  } catch (error) {
    console.error(`Failed to delete document ${id}:`, error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
