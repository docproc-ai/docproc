import { useNavigate, useParams, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DocumentTypeForm } from '@/components/document-type-form'
import type { JsonSchema } from '@/components/schema-builder'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { WebhookConfig } from '@/components/webhook-config'
import {
  useDeleteDocumentType,
  useDocumentType,
  useUpdateDocumentType,
} from '@/lib/queries'

export default function DocumentTypeSettingsPage() {
  const params = useParams({ strict: false })
  const slug = params.slug as string
  const navigate = useNavigate()
  const router = useRouter()

  const handleBack = () => {
    router.history.back()
  }

  const { data: docType, isLoading } = useDocumentType(slug)
  const updateDocumentType = useUpdateDocumentType()
  const deleteDocumentType = useDeleteDocumentType()

  const [formData, setFormData] = useState<{
    name: string
    validationInstructions: string
    modelName: string
    slugPattern: string
    schema: JsonSchema
    webhookConfig: WebhookConfig | null
    isValid: boolean
  } | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Track changes by comparing with initial data
  useEffect(() => {
    if (docType && formData) {
      const hasNameChange = formData.name !== docType.name
      const hasInstructionsChange =
        (formData.validationInstructions || '') !==
        (docType.validationInstructions || '')
      const hasModelChange =
        (formData.modelName || '') !== (docType.modelName || '')
      const hasSlugPatternChange =
        (formData.slugPattern || '') !== (docType.slugPattern || '')
      const hasSchemaChange =
        JSON.stringify(formData.schema) !== JSON.stringify(docType.schema)
      const hasWebhookChange =
        JSON.stringify(formData.webhookConfig) !==
        JSON.stringify(docType.webhookConfig || null)
      setHasChanges(
        hasNameChange ||
          hasInstructionsChange ||
          hasModelChange ||
          hasSlugPatternChange ||
          hasSchemaChange ||
          hasWebhookChange,
      )
    }
  }, [docType, formData])

  const handleSubmit = async () => {
    if (!formData || !formData.isValid) {
      setError('Please fill in all required fields')
      return
    }

    setError(null)

    try {
      await updateDocumentType.mutateAsync({
        slugOrId: slug,
        data: {
          name: formData.name,
          schema: formData.schema as Record<string, unknown>,
          validationInstructions: formData.validationInstructions || null,
          modelName: formData.modelName || null,
          slugPattern: formData.slugPattern || null,
          webhookConfig: formData.webhookConfig as Record<
            string,
            unknown
          > | null,
        },
      })

      setHasChanges(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update document type',
      )
    }
  }

  const handleDelete = async () => {
    if (
      !confirm(
        'Are you sure you want to delete this document type? This will also delete all associated documents.',
      )
    ) {
      return
    }

    try {
      await deleteDocumentType.mutateAsync(slug)
      navigate({ to: '/document-types' })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete document type',
      )
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
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
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

  if (isLoading) {
    return (
      <div className="bg-background text-foreground flex h-screen flex-col">
        <header className="border-border flex flex-shrink-0 items-center gap-4 border-b px-6 py-3">
          <Button variant="outline" size="icon" onClick={handleBack}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Button>
          <h1 className="text-xl font-semibold">Edit Document Type</h1>
        </header>
        <main className="flex-grow overflow-auto p-6 pb-96">
          {renderSkeleton()}
        </main>
      </div>
    )
  }

  if (!docType) {
    return (
      <div className="container mx-auto px-6 py-8 max-w-3xl">
        <div className="bg-destructive/10 text-destructive rounded-lg p-6">
          <h3 className="font-medium mb-1">Document type not found</h3>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground flex h-screen flex-col">
      <header className="border-border flex flex-shrink-0 items-center gap-4 border-b px-6 py-3">
        <Button variant="outline" size="icon" onClick={handleBack}>
          <ArrowLeft className="size-4" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="text-xl font-semibold">Edit Document Type</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={handleDelete}
            disabled={deleteDocumentType.isPending}
          >
            {deleteDocumentType.isPending ? 'Deleting...' : 'Delete'}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              updateDocumentType.isPending || !formData?.isValid || !hasChanges
            }
          >
            {updateDocumentType.isPending ? (
              <>
                <Loader2 className="animate-spin size-4" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      <main className="flex-grow overflow-auto p-6 pb-96">
        <DocumentTypeForm
          initialData={{
            name: docType.name,
            validationInstructions: docType.validationInstructions || null,
            modelName: docType.modelName || '',
            slugPattern: docType.slugPattern || null,
            schema: docType.schema as JsonSchema,
            webhookConfig: docType.webhookConfig as WebhookConfig | null,
          }}
          onFormDataChange={setFormData}
        />
      </main>
    </div>
  )
}
