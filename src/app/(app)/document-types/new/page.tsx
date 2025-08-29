'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createDocumentType } from '@/lib/actions/document-type'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { PageLoadingSkeleton } from '@/components/ui/loading-skeletons'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'
import { authClient } from '@/lib/auth-client'
import { DocumentTypeForm } from '@/components/document-type-form'
import type { DocumentWebhookConfig as WebhookConfig } from '@/lib/webhook-encryption'
import type { JsonSchema } from '@/components/schema-builder'

export default function NewDocumentTypePage() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<{
    name: string
    webhookConfig: WebhookConfig | null
    providerName: string
    modelName: string
    schema: JsonSchema
    isValid: boolean
  } | null>(null)

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

      const result = await createDocumentType(submitData)

      if (result.success) {
        toast.success(`Document type "${formData.name}" has been created.`)
        router.push('/document-types')
      } else {
        toast.error('error' in result ? result.error : 'Failed to create document type')
      }
    } catch (error: any) {
      toast.error(`Something went wrong: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-background text-foreground flex h-screen flex-col">
      <header className="border-border flex flex-shrink-0 items-center gap-4 border-b px-6 py-3">
        <Button variant="outline" size="icon" asChild>
          <Link href="/document-types">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">Create New Document Type</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={handleSubmit} disabled={isLoading || !formData?.isValid}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>
      <main className="flex-grow overflow-auto p-6 pb-96">
        <DocumentTypeForm onFormDataChange={setFormData} />
      </main>
    </div>
  )
}
