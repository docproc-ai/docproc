'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getDocumentType, updateDocumentType } from '@/lib/actions/document-type'
import { authClient } from '@/lib/auth-client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { PageLoadingSkeleton } from '@/components/ui/loading-skeletons'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { DeleteDocumentTypeDialog } from '@/components/delete-document-type-dialog'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { DocumentTypeForm } from '@/components/document-type-form'
import { type DocumentWebhookConfig as WebhookConfig } from '@/lib/webhook-encryption'
import { type JsonSchema } from '@/components/schema-builder'

export default function EditDocumentTypePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { data: session } = authClient.useSession()

  const [initialData, setInitialData] = useState<{
    name: string
    webhookConfig: WebhookConfig | null
    providerName: string
    modelName: string
    schema: JsonSchema
  } | null>(null)
  const [formData, setFormData] = useState<{
    name: string
    webhookConfig: WebhookConfig | null
    providerName: string
    modelName: string
    schema: JsonSchema
    isValid: boolean
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)

  // Redirect non-admin users
  useEffect(() => {
    if (session && session.user?.role !== 'admin') {
      router.push('/document-types')
    }
  }, [session, router])

  // Show loading while checking session
  if (!session) {
    return <PageLoadingSkeleton />
  }

  // Don't render if not admin
  if (session.user?.role !== 'admin') {
    return null
  }

  useEffect(() => {
    if (!id) return
    const fetchDocumentType = async () => {
      setIsFetching(true)
      try {
        const data = await getDocumentType(id)
        if (!data) {
          throw new Error('Document type not found.')
        }
        setInitialData({
          name: data.name,
          webhookConfig: data.webhookConfig as WebhookConfig | null,
          providerName: data.providerName || '',
          modelName: data.modelName || '',
          schema: data.schema as JsonSchema,
        })
      } catch (error: any) {
        toast.error(`Error fetching data: ${error.message}`)
        router.push('/document-types')
      } finally {
        setIsFetching(false)
      }
    }
    fetchDocumentType()
  }, [id, router])

  const handleSubmit = async () => {
    if (!formData || !formData.isValid) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsLoading(true)
    try {
      const submitData = new FormData()
      submitData.append('name', formData.name)
      submitData.append('schema', JSON.stringify(formData.schema))
      if (formData.webhookConfig) {
        submitData.append('webhookConfig', JSON.stringify(formData.webhookConfig))
      }
      submitData.append('providerName', formData.providerName)
      submitData.append('modelName', formData.modelName)

      const result = await updateDocumentType(id, submitData)

      if (result.success) {
        toast.success(`Document type "${formData.name}" has been updated.`)
        // Stay on the page after saving - don't redirect
      } else {
        toast.error('error' in result ? result.error : 'Failed to update document type')
      }
    } catch (error: any) {
      toast.error(`Something went wrong: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const renderSkeleton = () => (
    <div className="mx-auto max-w-4xl space-y-8">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="bg-background text-foreground flex h-screen flex-col">
      <header className="border-border flex flex-shrink-0 items-center gap-4 border-b px-6 py-3">
        <Button variant="outline" size="icon" asChild>
          <Link href="/document-types">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">Edit Document Type</h1>
        <div className="ml-auto flex items-center gap-2">
          <DeleteDocumentTypeDialog
            documentTypeId={id}
            documentTypeName={formData?.name || initialData?.name || ''}
          />
          <Button onClick={handleSubmit} disabled={isLoading || isFetching || !formData?.isValid}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>
      <main className="flex-grow overflow-auto p-6 pb-96">
        {isFetching
          ? renderSkeleton()
          : initialData && (
              <DocumentTypeForm initialData={initialData} onFormDataChange={setFormData} />
            )}
      </main>
    </div>
  )
}
