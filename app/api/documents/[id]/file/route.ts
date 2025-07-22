import { NextResponse } from "next/server"
import { DocumentsDatabase } from "@/lib/database"
import { FileStorage } from "@/lib/file-storage"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const docsDb = new DocumentsDatabase()
    
    // Find document by ID directly (no need for documentTypeId with global database)
    const document = await docsDb.findById(id)
    
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Check if document uses file storage system
    if (!document.file_path) {
      return NextResponse.json({ error: "Document file path not found" }, { status: 404 })
    }

    let buffer: Buffer
    try {
      buffer = await FileStorage.readFile(document.file_path)
    } catch (error) {
      console.error(`Failed to read file from storage: ${document.file_path}`, error)
      return NextResponse.json({ error: "Document file not found on disk" }, { status: 404 })
    }
    
    // Use stored MIME type or determine from filename
    const contentType = document.mime_type || getContentType(document.original_filename)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${document.original_filename}"`,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error(`Failed to serve document file:`, error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

function getContentType(filename: string): string {
  const extension = filename.toLowerCase().split('.').pop() || ''
  const contentTypes: { [key: string]: string } = {
    'pdf': 'application/pdf',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'webp': 'image/webp',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
    'svg': 'image/svg+xml'
  }
  
  return contentTypes[extension] || 'application/octet-stream'
}
