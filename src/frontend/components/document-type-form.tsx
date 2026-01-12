import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SchemaBuilder, type JsonSchema } from '@/components/schema-builder'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SchemaEditorTab } from '@/components/editor-tabs'
import Editor from '@/components/editor'
import { ModelSelector } from '@/components/model-selector'

interface DocumentTypeFormProps {
  initialData?: {
    name: string
    validationInstructions: string | null
    modelName: string
    schema: JsonSchema
  }
  onFormDataChange?: (formData: {
    name: string
    validationInstructions: string
    modelName: string
    schema: JsonSchema
    isValid: boolean
  }) => void
}

const defaultSchema: JsonSchema = {
  type: 'object',
  title: 'New Document',
  properties: {
    field_1: {
      type: 'string',
      title: 'Field 1',
      description: 'Description for field 1',
    },
  },
  required: ['field_1'],
}

export function DocumentTypeForm({
  initialData,
  onFormDataChange,
}: DocumentTypeFormProps) {
  const [name, setName] = useState(initialData?.name || '')
  const [validationInstructions, setValidationInstructions] = useState(
    initialData?.validationInstructions || '',
  )
  const [modelName, setModelName] = useState(initialData?.modelName || '')
  const [schemaText, setSchemaText] = useState(
    JSON.stringify(initialData?.schema || defaultSchema, null, 2),
  )

  const isValid = !!name

  const schema: JsonSchema = useMemo(() => {
    try {
      return JSON.parse(schemaText)
    } catch (e) {
      return { type: 'object', properties: {} }
    }
  }, [schemaText])

  // Notify parent component when form data changes
  useEffect(() => {
    if (onFormDataChange) {
      onFormDataChange({
        name,
        validationInstructions,
        modelName,
        schema,
        isValid,
      })
    }
  }, [name, validationInstructions, modelName, schema, isValid, onFormDataChange])

  const handleSchemaTextChange = useCallback((text: string | undefined) => {
    setSchemaText(text || '')
  }, [])

  const handleSchemaBuilderChange = useCallback((newSchema: JsonSchema) => {
    setSchemaText(JSON.stringify(newSchema, null, 2))
  }, [])

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
          <CardDescription>Give your document type a name and configure AI model.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Invoices"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="modelName">AI Model (optional)</Label>
            <ModelSelector
              value={modelName}
              onChange={setModelName}
              placeholder="Select a model or use default..."
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use the default model. You can also type a custom model ID.
            </p>
          </div>
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
