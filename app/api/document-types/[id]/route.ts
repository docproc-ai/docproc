import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDocumentType, updateDocumentType, deleteDocumentType } from '@/lib/drizzle-filesystem'

const updateDocumentTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  schema: z.record(z.any()), // More permissive - allows any object including $schema
  webhook_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  webhook_method: z.enum(['POST', 'PUT']).optional(),
})

// GET a single document type by ID
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const docType = await getDocumentType(parseInt(id))

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
    const { id } = await params
    const body = await request.json()
    const validation = updateDocumentTypeSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.flatten().fieldErrors }, { status: 400 })
    }

    const { name, schema, webhook_url, webhook_method } = validation.data

    // Remove $schema property if present (NeDB doesn't allow field names starting with $)
    const cleanSchema = { ...schema }
    delete cleanSchema.$schema

    const updatedType = await updateDocumentType(parseInt(id), {
      name,
      schema: cleanSchema,
      webhookUrl: webhook_url || undefined,
      webhookMethod: webhook_method || 'POST',
    })

    if (!updatedType) {
      return NextResponse.json({ error: 'Document type not found' }, { status: 404 })
    }

    return NextResponse.json(updatedType, { status: 200 })
  } catch (error: any) {
    console.error('Failed to update document type:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE a document type and all its associated documents/files
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Document Type ID is required' }, { status: 400 })
  }

  try {
    // Delete the document type and all its associated documents/files
    // The deleteDocumentType function handles removing the entire directory structure
    const success = await deleteDocumentType(parseInt(id))

    if (!success) {
      return NextResponse.json({ error: 'Document type not found' }, { status: 404 })
    }

    return NextResponse.json(
      { message: 'Document type and all associated documents deleted successfully.' },
      { status: 200 },
    )
  } catch (error) {
    console.error(`Failed to delete document type ${id}:`, error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
