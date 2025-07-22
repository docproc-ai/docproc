import { NextResponse } from "next/server"
import { getDocument, updateDocument, deleteDocument, getDocumentFile, saveDocumentData, getDocumentType } from "@/lib/filesystem"
import { z } from "zod"

const updateDocumentSchema = z.object({
  extracted_data: z.any(),
  status: z.enum(["pending", "approved", "rejected", "processing_failed"]),
  schema_snapshot: z.any().optional(),
})

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
  }

  try {
    const body = await request.json()
    const validation = updateDocumentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.flatten().fieldErrors }, { status: 400 })
    }

    const { extracted_data, status, schema_snapshot } = validation.data

    // Parse document ID to get document type and doc ID
    const urlParts = new URL(request.url).pathname.split('/')
    const documentId = urlParts[urlParts.length - 1]
    
    // We need to find which document type this document belongs to
    // Since we don't have the document type ID in the URL, we need to search for it
    // This is a limitation of the current API structure - ideally we'd have /api/document-types/{typeId}/documents/{docId}
    
    // For now, let's extract the document type from the request or find it by searching
    const documentTypeId = request.headers.get('x-document-type-id')
    if (!documentTypeId) {
      return NextResponse.json({ error: "Document type ID is required in x-document-type-id header" }, { status: 400 })
    }

    // Save the extracted data and schema snapshot
    if (schema_snapshot) {
      await saveDocumentData(documentTypeId, documentId, extracted_data, schema_snapshot)
    }

    // Update document status
    const updatedDocument = await updateDocument(documentTypeId, documentId, {
      status,
      processed_at: new Date().toISOString()
    })

    if (!updatedDocument) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // --- Webhook Trigger Logic ---
    if (status === "approved") {
      try {
        const docType = await getDocumentType(documentTypeId)

        if (docType && docType.webhook_url) {
          console.log(`Triggering webhook for document ${id} to ${docType.webhook_url}`)
          fetch(docType.webhook_url, {
            method: docType.webhook_method || "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...updatedDocument,
              extracted_data,
              schema_snapshot
            }),
          }).catch((webhookError) => {
            console.error(`Webhook failed for document ${id}:`, webhookError)
          })
        }
      } catch (error) {
        console.error(`Failed to fetch document type for webhook trigger for document ${id}:`, error)
      }
    }
    // --- END: Webhook Trigger Logic ---

    return NextResponse.json({
      ...updatedDocument,
      extracted_data,
      schema_snapshot
    })
  } catch (error) {
    console.error(`Failed to update document ${id}:`, error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
  }

  try {
    // We need the document type ID to delete the document
    const documentTypeId = request.headers.get('x-document-type-id')
    if (!documentTypeId) {
      return NextResponse.json({ error: "Document type ID is required in x-document-type-id header" }, { status: 400 })
    }

    const success = await deleteDocument(documentTypeId, id)

    if (!success) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    return NextResponse.json({ message: "Document deleted successfully" }, { status: 200 })
  } catch (error) {
    console.error(`Failed to delete document ${id}:`, error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
