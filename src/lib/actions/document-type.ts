'use server'

import { db } from '@/db'
import { documentType, document } from '@/db/schema'
import { eq, desc, count } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'

export type DocumentType = InferSelectModel<typeof documentType>
export type NewDocumentType = InferInsertModel<typeof documentType>

async function checkAdminAccess() {
  const headersList = await headers()
  
  // Check for API key authentication first
  const apiKey = headersList.get('x-api-key')
  if (apiKey && apiKey === process.env.API_KEY) {
    return { success: true }
  }

  // Fall back to session authentication
  const session = await auth.api.getSession({
    headers: headersList,
  })

  if (!session?.user) {
    return { success: false, error: 'Authentication required' }
  }

  if (session.user.role !== 'admin') {
    return { success: false, error: 'Admin access required' }
  }

  return { success: true }
}

export async function getDocumentTypes(): Promise<(DocumentType & { document_count: number })[]> {
  try {
    const documentTypes = await db.select().from(documentType).orderBy(desc(documentType.createdAt))

    const typesWithCounts = await Promise.all(
      documentTypes.map(async (type) => {
        const [countResult] = await db
          .select({ count: count() })
          .from(document)
          .where(eq(document.documentTypeId, type.id))

        return {
          ...type,
          document_count: countResult.count,
        }
      }),
    )

    return typesWithCounts
  } catch (error) {
    console.error('Failed to get document types:', error)
    return []
  }
}

export async function getDocumentType(id: number): Promise<DocumentType | null> {
  try {
    const [result] = await db.select().from(documentType).where(eq(documentType.id, id))
    return result || null
  } catch (error) {
    console.error('Failed to get document type:', error)
    return null
  }
}

export async function createDocumentType(formData: FormData) {
  // Check admin access
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.success) {
    return adminCheck
  }

  try {
    const name = formData.get('name') as string
    const schemaString = formData.get('schema') as string
    const webhookUrl = formData.get('webhookUrl') as string
    const webhookMethod = formData.get('webhookMethod') as string
    const modelName = formData.get('modelName') as string

    if (!name || !schemaString) {
      return { success: false, error: 'Name and schema are required' }
    }

    let schema
    try {
      schema = JSON.parse(schemaString)
    } catch {
      return { success: false, error: 'Invalid JSON schema' }
    }

    const [result] = await db
      .insert(documentType)
      .values({
        name,
        schema,
        webhookUrl: webhookUrl || null,
        webhookMethod: webhookMethod || 'POST',
        modelName: modelName || null,
      })
      .returning()

    revalidatePath('/document-types')
    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to create document type:', error)
    return { success: false, error: 'Failed to create document type' }
  }
}

export async function updateDocumentType(id: number, formData: FormData) {
  // Check admin access
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.success) {
    return adminCheck
  }

  try {
    const name = formData.get('name') as string
    const schemaString = formData.get('schema') as string
    const webhookUrl = formData.get('webhookUrl') as string
    const webhookMethod = formData.get('webhookMethod') as string
    const modelName = formData.get('modelName') as string

    if (!name || !schemaString) {
      return { success: false, error: 'Name and schema are required' }
    }

    let schema
    try {
      schema = JSON.parse(schemaString)
    } catch {
      return { success: false, error: 'Invalid JSON schema' }
    }

    const [result] = await db
      .update(documentType)
      .set({
        name,
        schema,
        webhookUrl: webhookUrl || null,
        webhookMethod: webhookMethod || 'POST',
        modelName: modelName || null,
        updatedAt: new Date(),
      })
      .where(eq(documentType.id, id))
      .returning()

    if (!result) {
      return { success: false, error: 'Document type not found' }
    }

    revalidatePath('/document-types')
    revalidatePath(`/document-types/edit/${id}`)
    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to update document type:', error)
    return { success: false, error: 'Failed to update document type' }
  }
}

export async function deleteDocumentType(id: number) {
  // Check admin access
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.success) {
    throw new Error(adminCheck.error)
  }

  try {
    // First delete all documents of this type
    await db.delete(document).where(eq(document.documentTypeId, id))

    // Then delete the document type
    await db.delete(documentType).where(eq(documentType.id, id))

    revalidatePath('/document-types')
  } catch (error) {
    console.error('Failed to delete document type:', error)
    throw error
  }
}
