import { NextResponse } from 'next/server'
import { db } from '@/db'
import { document } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getStorageDir } from '@/lib/storage'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Find document by ID directly
    const [doc] = await db.select().from(document).where(eq(document.id, parseInt(id)))

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Check if document uses file storage system
    if (!doc.storagePath) {
      return NextResponse.json({ error: 'Document file path not found' }, { status: 404 })
    }

    let buffer: Buffer
    try {
      const filePath = join(getStorageDir(), doc.storagePath)
      buffer = await readFile(filePath)
    } catch (error) {
      console.error(`Failed to read file from storage: ${doc.storagePath}`, error)
      return NextResponse.json({ error: 'Document file not found on disk' }, { status: 404 })
    }

    // Use stored MIME type or determine from filename
    const contentType = getContentType(doc.filename)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${doc.filename}"`,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error(`Failed to serve document file:`, error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

function getContentType(filename: string): string {
  const extension = filename.toLowerCase().split('.').pop() || ''
  const contentTypes: { [key: string]: string } = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    svg: 'image/svg+xml',
  }

  return contentTypes[extension] || 'application/octet-stream'
}
