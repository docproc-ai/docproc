'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getDocumentType, updateDocumentType } from '@/lib/actions/document-type'
import { authClient } from '@/lib/auth-client'
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
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SchemaEditorTab } from '@/components/editor-tabs'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { SettingsDialog } from '@/components/settings-dialog'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { DeleteDocumentTypeDialog } from '@/components/delete-document-type-dialog'

export default function EditDocumentTypePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { data: session } = authClient.useSession()

  const [name, setName] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookMethod, setWebhookMethod] = useState('POST')
  const [schemaText, setSchemaText] = useState('')
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
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
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
        const data = await getDocumentType(parseInt(id))
        if (!data) {
          throw new Error('Document type not found.')
        }
        setName(data.name)
        setWebhookUrl(data.webhookUrl || '')
        setWebhookMethod(data.webhookMethod || 'POST')
        setSchemaText(JSON.stringify(data.schema, null, 2))
      } catch (error: any) {
        toast.error(`Error fetching data: ${error.message}`)
        router.push('/document-types')
      } finally {
        setIsFetching(false)
      }
    }
    fetchDocumentType()
  }, [id, router])

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
      formData.append('webhookUrl', webhookUrl)
      formData.append('webhookMethod', webhookMethod)

      const result = await updateDocumentType(parseInt(id), formData)

      if (result.success) {
        toast.success(`Document type "${name}" has been updated.`)
        router.push('/document-types')
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
          <DeleteDocumentTypeDialog documentTypeId={id} documentTypeName={name} />
          <Button onClick={handleSubmit} disabled={isLoading || isFetching || !name}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
          <SettingsDialog />
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>
      <main className="flex-grow overflow-auto p-6">
        {isFetching ? (
          renderSkeleton()
        ) : (
          <div className="mx-auto max-w-4xl space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>General Information</CardTitle>
                <CardDescription>
                  Give your document type a name and configure an optional webhook for when
                  documents are approved.
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
                <div className="flex flex-row gap-4">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="webhookUrl">Webhook URL (Optional)</Label>
                    <Input
                      id="webhookUrl"
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://api.example.com/invoices"
                    />
                  </div>
                  <div className="space-y-2 w-32">
                    <Label htmlFor="webhookMethod">Method</Label>
                    <Select value={webhookMethod} onValueChange={setWebhookMethod}>
                      <SelectTrigger className="w-full" id="webhookMethod">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
        )}
      </main>
    </div>
  )
}
