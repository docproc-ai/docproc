import { NextResponse } from 'next/server'
import { getDocumentTypes, createDocumentType } from '@/lib/actions/document-type'
import { checkApiAuth } from '@/lib/api-auth'

export async function GET() {
  try {
    // Check if user has permission to list document types (or has valid API key)
    const authCheck = await checkApiAuth({
      documentType: ['list']
    });

    if (!authCheck.success) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const documentTypes = await getDocumentTypes()

    // Return simplified data for external API consumers
    const simplifiedTypes = documentTypes.map((type) => ({
      id: type.id,
      name: type.name,
      document_count: type.document_count,
      createdAt: type.createdAt,
    }))

    return NextResponse.json(simplifiedTypes)
  } catch (error) {
    console.error('Failed to fetch document types:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Check if user has permission to create document types (or has valid API key)
    const authCheck = await checkApiAuth({
      documentType: ['create']
    });

    if (!authCheck.success) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

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

    const result = await createDocumentType(formData)

    if (!result.success) {
      const errorMessage = 'error' in result ? result.error : 'Failed to create document type'
      if (errorMessage === 'Admin access required') {
        return NextResponse.json({ error: errorMessage }, { status: 403 })
      }
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    return NextResponse.json('data' in result ? result.data : {}, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create document type:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
