import { NextResponse } from 'next/server'
import { getDocuments, createDocument } from '@/lib/drizzle-filesystem'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const documentTypeId = searchParams.get('documentTypeId')

  if (!documentTypeId) {
    return NextResponse.json({ error: 'documentTypeId is required' }, { status: 400 })
  }

  try {
    const documents = await getDocuments(parseInt(documentTypeId))
    return NextResponse.json(documents)
  } catch (error) {
    console.error('Failed to fetch documents:', error)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const filename = request.headers.get('x-vercel-filename') || 'document.pdf'
  const documentTypeId = searchParams.get('documentTypeId')

  if (!request.body) {
    return NextResponse.json({ error: 'No file body' }, { status: 400 })
  }

  if (!documentTypeId) {
    return NextResponse.json({ error: 'documentTypeId is required' }, { status: 400 })
  }

  try {
    // Convert the request body to a buffer
    const fileBuffer = Buffer.from(await request.arrayBuffer())

    // Create document in filesystem
    const newDocument = await createDocument(parseInt(documentTypeId), filename, fileBuffer)

    return NextResponse.json(newDocument)
  } catch (error) {
    console.error('Upload failed:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
