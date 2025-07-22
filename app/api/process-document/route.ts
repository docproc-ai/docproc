import { anthropic } from "@ai-sdk/anthropic"
import { generateObject, jsonSchema } from "ai"
import { getDocumentFile, saveDocumentData, getDocumentType } from "@/lib/filesystem"

export async function POST(req: Request) {
  let model, schema, documentTypeId, documentId
  try {
    const body = await req.json()
    model = body.model
    schema = body.schema
    documentTypeId = body.documentTypeId
    documentId = body.documentId

    if (!documentTypeId || !documentId || !schema || !model) {
      return new Response(JSON.stringify({ error: "Missing required parameters: documentTypeId, documentId, schema, or model." }), {
        status: 400,
      })
    }

    // Get the document file from filesystem
    const fileData = await getDocumentFile(documentTypeId, documentId)
    if (!fileData) {
      return new Response(JSON.stringify({ error: "Document file not found." }), {
        status: 404,
      })
    }

    // Get document type to get the schema
    const documentType = await getDocumentType(documentTypeId)
    if (!documentType) {
      return new Response(JSON.stringify({ error: "Document type not found." }), {
        status: 404,
      })
    }

    // Prepare the raw schema object, ensuring it has a root 'type' and 'properties'.
    const rawSchema = {
      ...schema,
      type: "object",
      properties: schema.properties || {},
    }

    // Use the `jsonSchema` helper from the AI SDK to create a compatible schema object.
    const schemaForAI = jsonSchema<any>(rawSchema)

    // Determine file type from filename
    const fileExtension = fileData.filename.toLowerCase().split('.').pop()
    const mimeType = getMimeType(fileExtension || '')

    const messageContent: (
      | { type: "text"; text: string }
      | { type: "image"; image: Buffer }
      | { type: "file"; data: Buffer; mimeType?: string; filename?: string }
    )[] = [
      {
        type: "text",
        text: `Please analyze the attached document and extract the data according to the provided schema.`,
      },
    ]

    if (mimeType.startsWith("image/")) {
      messageContent.push({ type: "image", image: fileData.buffer })
    } else {
      messageContent.push({ 
        type: "file", 
        data: fileData.buffer, 
        mimeType: mimeType,
        filename: fileData.filename
      })
    }

    const { object } = await generateObject({
      model: anthropic(model),
      schema: schemaForAI,
      system: `You are an expert document processor. Your task is to analyze the provided document (which could be a PDF or an image) and extract information into a structured JSON object based on the user-provided schema.

**CRITICAL INSTRUCTIONS:**
1.  **Analyze the ENTIRE document provided.**
2.  **Date Formatting**: For any date field, you MUST format it as \`YYYY-MM-DD\`.
3.  **Do NOT Guess**: If you cannot find information for a field, OMIT it from your response. Do not hallucinate data.
4.  **Follow Schema**: Adhere strictly to the JSON schema for the output format. Pay close attention to field names, types, and nested structures.`,
      messages: [
        {
          role: "user",
          content: messageContent as any,
        },
      ],
    })

    // Save the extracted data to filesystem
    await saveDocumentData(documentTypeId, documentId, object, schema)

    return new Response(JSON.stringify({ data: object }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error: any) {
    console.error("AI processing failed:", {
      model: model || "Unknown",
      schema: schema?.title || "Unknown",
      documentTypeId: documentTypeId || "Unknown",
      documentId: documentId || "Unknown",
      errorMessage: error.message,
    })
    return new Response(JSON.stringify({ error: error.message || "An internal server error occurred." }), {
      status: 500,
    })
  }
}

function getMimeType(extension: string): string {
  const mimeTypes: { [key: string]: string } = {
    'pdf': 'application/pdf',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'webp': 'image/webp',
    'tiff': 'image/tiff',
    'tif': 'image/tiff'
  }
  
  return mimeTypes[extension] || 'application/octet-stream'
}
