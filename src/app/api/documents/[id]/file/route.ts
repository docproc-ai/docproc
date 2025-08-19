import { NextResponse } from 'next/server'
import { db } from '@/db'
import { document } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import { getStorageDir } from '@/lib/storage'
import { checkApiAuth } from '@/lib/api-auth'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check if user has permission to list documents (needed to access files) or has valid API key
    const authCheck = await checkApiAuth({
      document: ['list']
    });

    if (!authCheck.success) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params

    // Find document by ID directly
    const [doc] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Check if document uses file storage system
    if (!doc.storagePath) {
      return NextResponse.json({ error: 'Document file path not found' }, { status: 404 })
    }

    let buffer: Buffer
    let fileStats: any
    try {
      const filePath = join(getStorageDir(), doc.storagePath)
      buffer = await readFile(filePath)
      fileStats = await stat(filePath)
    } catch (error) {
      console.error(`Failed to read file from storage: ${doc.storagePath}`, error)
      return NextResponse.json({ error: 'Document file not found on disk' }, { status: 404 })
    }

    // Use stored MIME type or determine from filename
    const contentType = getContentType(doc.filename)

    // Use file modification time for ETag and cache control
    const lastModified = fileStats.mtime.toUTCString()
    const etag = `"${fileStats.size}-${fileStats.mtime.getTime()}"`
    
    // Check if client has current version (conditional request)
    const ifNoneMatch = request.headers.get('if-none-match')
    const ifModifiedSince = request.headers.get('if-modified-since')
    
    if (ifNoneMatch === etag || ifModifiedSince === lastModified) {
      return new NextResponse(null, { status: 304 }) // Not Modified
    }

    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${doc.filename}"`,
        'Last-Modified': lastModified,
        'ETag': etag,
        'Cache-Control': 'public, max-age=3600, must-revalidate', // Normal caching with revalidation
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
