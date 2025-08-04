'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createDocumentType } from '@/lib/actions/document-type'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SchemaBuilder, type JsonSchema } from '@/components/schema-builder'
import { WebhookConfigComponent } from '@/components/webhook-config'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SchemaEditorTab } from '@/components/editor-tabs'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { PageLoadingSkeleton, ButtonLoadingSkeleton } from '@/components/ui/loading-skeletons'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'
import { authClient } from '@/lib/auth-client'
import { ANTHROPIC_MODELS } from '@/lib/models/anthropic'
import type { WebhookConfig } from '@/lib/webhook-encryption'
const initialSchema: JsonSchema = {
  type: 'object',
  title: 'New Document',
  properties: {
    invoice_number: {
      type: 'string',
      title: 'Invoice Number',
      description: 'The unique identifier for the invoice',
    },
    total_amount: {
      type: 'number',
      title: 'Total Amount',
      description: 'The final amount due',
    },
  },
  required: ['invoice_number', 'total_amount'],
}

export default function NewDocumentTypePage() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const [name, setName] = useState('')
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig | null>(null)
  const [modelName, setModelName] = useState('')
  const [schemaText, setSchemaText] = useState(JSON.stringify(initialSchema, null, 2))
  const [isLoading, setIsLoading] = useState(false)

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

  const schema: JsonSchema = useMemo(() => {
    try {
      return JSON.parse(schemaText)
    } catch (e) {
      return { type: 'object', title: 'Invalid Schema', properties: {} }
    }
  }, [schemaText])

  const handleSchemaTextChange = useCallback((text: string | undefined) => {
    setSchemaText(text || '')
  }, [])

  const handleSchemaBuilderChange = useCallback((newSchema: JsonSchema) => {
    setSchemaText(JSON.stringify(newSchema, null, 2))
  }, [])

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('schema', JSON.stringify(schema))
      if (webhookConfig) {
        formData.append('webhookConfig', JSON.stringify(webhookConfig))
      }
      formData.append('modelName', modelName === '__none__' ? '' : modelName)

      const result = await createDocumentType(formData)

      if (result.success) {
        toast.success(`Document type "${name}" has been created.`)
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
          <Button onClick={handleSubmit} disabled={isLoading || !name}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>
      <main className="flex-grow overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>General Information</CardTitle>
              <CardDescription>
                Give your document type a name and select an AI model.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Invoices"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modelName">AI Model (Optional)</Label>
                <Select value={modelName} onValueChange={setModelName}>
                  <SelectTrigger id="modelName">
                    <SelectValue placeholder="Select a model (uses system default if not specified)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Use system default</SelectItem>
                    {ANTHROPIC_MODELS.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
              <CardDescription>
                Configure webhooks to be notified when documents reach different stages.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WebhookConfigComponent config={webhookConfig} onChange={setWebhookConfig} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schema Definition</CardTitle>
              <CardDescription>
                Define the structure of the data you want to extract. Use the builder for a visual
                experience or edit the JSON directly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="builder" className="flex h-full flex-col">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="builder">Builder</TabsTrigger>
                  <TabsTrigger value="schema">JSON</TabsTrigger>
                </TabsList>
                <div className="flex-grow overflow-auto pt-4">
                  <TabsContent value="builder">
                    <SchemaBuilder schema={schema} onChange={handleSchemaBuilderChange} />
                  </TabsContent>
                  <TabsContent value="schema" className="h-full">
                    <SchemaEditorTab value={schemaText} onChange={handleSchemaTextChange} />
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
