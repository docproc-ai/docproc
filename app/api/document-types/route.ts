import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createDocumentType, getDocumentTypes } from '@/lib/filesystem'
// import { isAuthenticated } from "@/lib/auth"

const createDocumentTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  schema: z.record(z.any()), // More permissive - allows any object including $schema
  webhook_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  webhook_method: z.enum(['POST', 'PUT']).optional(),
})

export async function POST(request: Request) {
  // if (!(await isAuthenticated(request as any))) {
  //   return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  // }
  try {
    const body = await request.json()
    const validation = createDocumentTypeSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.flatten().fieldErrors }, { status: 400 })
    }

    const { name, schema, webhook_url, webhook_method } = validation.data

    // Remove $schema property if present (NeDB doesn't allow field names starting with $)
    const cleanSchema = { ...schema }
    delete cleanSchema.$schema

    const newType = await createDocumentType({
      name,
      schema: cleanSchema,
      webhook_url: webhook_url || undefined,
      webhook_method: webhook_method || 'POST',
    })

    return NextResponse.json(newType, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create document type:', error)
    // Check for unique constraint violation
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A document type with this name already exists.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const documentTypes = await getDocumentTypes()
    return NextResponse.json(documentTypes)
  } catch (error) {
    console.error('Failed to fetch document types:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
