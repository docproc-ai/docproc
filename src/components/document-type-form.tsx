'use client'

import React, { useState, useMemo, useCallback } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SchemaEditorTab } from '@/components/editor-tabs'
import Editor from '@/components/editor'
import { Loader2, PlusIcon, ChevronsUpDownIcon } from 'lucide-react'
import { getAvailableProviders } from '@/lib/providers'
import {
  Combobox,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxInput,
  ComboboxList,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxCreateNew,
} from '@/components/ui/shadcn-io/combobox'
import { type DocumentWebhookConfig as WebhookConfig } from '@/lib/webhook-encryption'

interface DocumentTypeFormProps {
  initialData?: {
    name: string
    webhookConfig: WebhookConfig | null
    validationInstructions: string | null
    providerName: string
    modelName: string
    schema: JsonSchema
  }
  onFormDataChange?: (formData: {
    name: string
    webhookConfig: WebhookConfig | null
    validationInstructions: string
    providerName: string
    modelName: string
    schema: JsonSchema
    isValid: boolean
  }) => void
}

const defaultSchema: JsonSchema = {
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

export function DocumentTypeForm({
  initialData,
  onFormDataChange,
}: DocumentTypeFormProps) {
  const [name, setName] = useState(initialData?.name || '')
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig | null>(
    initialData?.webhookConfig || null,
  )
  const [validationInstructions, setValidationInstructions] = useState(
    initialData?.validationInstructions || '',
  )
  const [providerName, setProviderName] = useState(initialData?.providerName || '')
  const [modelName, setModelName] = useState(initialData?.modelName || '')
  const [schemaText, setSchemaText] = useState(
    JSON.stringify(initialData?.schema || defaultSchema, null, 2),
  )

  const availableProviders = getAvailableProviders()
  const selectedProvider = availableProviders.find((p) => p.name === providerName)

  const isValid = !!(name && providerName && modelName)

  const schema: JsonSchema = useMemo(() => {
    try {
      return JSON.parse(schemaText)
    } catch (e) {
      return { type: 'object', title: 'Invalid Schema', properties: {} }
    }
  }, [schemaText])

  // Notify parent component when form data changes
  React.useEffect(() => {
    if (onFormDataChange) {
      onFormDataChange({
        name,
        webhookConfig,
        validationInstructions,
        providerName,
        modelName,
        schema,
        isValid,
      })
    }
  }, [name, webhookConfig, validationInstructions, providerName, modelName, schema, isValid, onFormDataChange])

  const handleSchemaTextChange = useCallback((text: string | undefined) => {
    setSchemaText(text || '')
  }, [])

  const handleSchemaBuilderChange = useCallback((newSchema: JsonSchema) => {
    setSchemaText(JSON.stringify(newSchema, null, 2))
  }, [])

  // Expose handleSubmit to parent via onSubmit prop when called

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
          <CardDescription>Give your document type a name and select an AI model.</CardDescription>
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
            <Label>AI Provider and Model *</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="providerName" className="text-muted-foreground text-sm">
                  Provider
                </Label>
                <Select
                  value={providerName}
                  onValueChange={(value) => {
                    setProviderName(value)
                    setModelName('') // Reset model when provider changes
                  }}
                >
                  <SelectTrigger id="providerName">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProviders.map((provider) => (
                      <SelectItem key={provider.name} value={provider.name}>
                        {provider.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {providerName && selectedProvider && (
                <div>
                  <Label htmlFor="modelName" className="text-muted-foreground text-sm">
                    Model
                  </Label>
                  <Combobox
                    data={selectedProvider.models.map((model) => ({
                      label: model,
                      value: model,
                    }))}
                    type="model"
                    value={modelName}
                    onValueChange={setModelName}
                  >
                    <ComboboxTrigger className="min-w-full">
                      <span className="flex w-full items-center justify-between gap-2">
                        {modelName || 'Select or type model...'}
                        <ChevronsUpDownIcon className="text-muted-foreground shrink-0" size={16} />
                      </span>
                    </ComboboxTrigger>
                    <ComboboxContent>
                      <ComboboxInput placeholder="Search or type model..." />
                      <ComboboxList>
                        <ComboboxEmpty />
                        <ComboboxGroup>
                          {selectedProvider.models.map((model) => (
                            <ComboboxItem key={model} value={model}>
                              <span className="truncate">{model}</span>
                            </ComboboxItem>
                          ))}
                        </ComboboxGroup>
                        <ComboboxCreateNew onCreateNew={(value) => setModelName(value)}>
                          {(inputValue) => (
                            <>
                              <PlusIcon className="text-muted-foreground h-4 w-4" />
                              <span>Custom: "{inputValue}"</span>
                            </>
                          )}
                        </ComboboxCreateNew>
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>
              )}
            </div>
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
          <CardTitle>Validation Instructions</CardTitle>
          <CardDescription>
            Define validation criteria to verify documents match this type before processing. This
            helps avoid wasting tokens on incorrect document types.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="validationInstructions">Instructions (optional)</Label>
            <p className="text-muted-foreground mb-2 text-sm">
              Describe what the document should contain. If validation fails, processing will be
              skipped.
            </p>
            <div className="h-[300px]">
              <Editor
                language="markdown"
                value={validationInstructions}
                onChange={(text) => setValidationInstructions(text || '')}
              />
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
  )
}
