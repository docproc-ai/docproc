import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateDocumentType } from '@/lib/queries'

// Simple JSON schema builder
function SchemaBuilder({
  fields,
  onChange,
}: {
  fields: Array<{ name: string; type: string; description: string }>
  onChange: (fields: Array<{ name: string; type: string; description: string }>) => void
}) {
  const addField = () => {
    onChange([...fields, { name: '', type: 'string', description: '' }])
  }

  const updateField = (index: number, key: string, value: string) => {
    const updated = [...fields]
    updated[index] = { ...updated[index], [key]: value }
    onChange(updated)
  }

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Extraction Fields</Label>
        <Button type="button" variant="outline" size="sm" onClick={addField}>
          Add Field
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <p className="text-muted-foreground mb-3">
            No fields defined yet. Add fields to extract from documents.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={addField}>
            Add First Field
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_120px_1fr_auto] gap-3 items-start p-4 bg-muted/50 rounded-lg"
              
            >
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Field Name</Label>
                <Input
                  value={field.name}
                  onChange={(e) => updateField(index, 'name', e.target.value)}
                  placeholder="e.g., invoice_number"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <select
                  value={field.type}
                  onChange={(e) => updateField(index, 'type', e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="string">Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Input
                  value={field.description}
                  onChange={(e) => updateField(index, 'description', e.target.value)}
                  placeholder="Help the AI understand this field"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-6 text-muted-foreground hover:text-destructive"
                onClick={() => removeField(index)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NewDocumentTypePage() {
  const navigate = useNavigate()
  const createDocumentType = useCreateDocumentType()

  const [name, setName] = useState('')
  const [validationInstructions, setValidationInstructions] = useState('')
  const [modelName, setModelName] = useState('')
  const [slugPattern, setSlugPattern] = useState('')
  const [fields, setFields] = useState<Array<{ name: string; type: string; description: string }>>([])
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    if (fields.length === 0) {
      setError('At least one field is required')
      return
    }

    // Build JSON Schema from fields
    const schema = {
      type: 'object',
      properties: fields.reduce(
        (acc, field) => {
          if (field.name) {
            acc[field.name] = {
              type: field.type,
              ...(field.description && { description: field.description }),
            }
          }
          return acc
        },
        {} as Record<string, unknown>
      ),
      required: fields.filter((f) => f.name).map((f) => f.name),
    }

    try {
      const result = await createDocumentType.mutateAsync({
        name,
        schema,
        validationInstructions: validationInstructions || undefined,
        modelName: modelName || undefined,
        slugPattern: slugPattern || undefined,
      })

      navigate({ to: '/document-types/$slug', params: { slug: result.slug } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document type')
    }
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/document-types" className="hover:text-foreground transition-colors">
          Document Types
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <span>New</span>
      </div>

      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-sans font-semibold tracking-tight">
          Create Document Type
        </h1>
        <p className="text-muted-foreground">
          Define the schema for extracting structured data from documents.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
            {error}
          </div>
        )}

        <Card className="">
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Invoice, Receipt, Contract"
                className="max-w-md"
              />
              <p className="text-xs text-muted-foreground">
                A human-readable name for this document type. A URL-safe slug will be generated automatically.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">AI Model (optional)</Label>
              <Input
                id="model"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g., google/gemini-2.0-flash-001"
                className="max-w-md font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use the default model configured in the server.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slugPattern">Document Slug Pattern (optional)</Label>
              <Input
                id="slugPattern"
                value={slugPattern}
                onChange={(e) => setSlugPattern(e.target.value)}
                placeholder="e.g., {vendor}-{invoice_number}-{id()}"
                className="max-w-md font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Pattern for generating document slugs from extracted data.
                Use <code className="bg-muted px-1 rounded">{'{field_name}'}</code> to reference schema fields,
                or <code className="bg-muted px-1 rounded">{'{id()}'}</code> for a unique ID.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="">
          <CardHeader>
            <CardTitle className="text-lg">Extraction Schema</CardTitle>
          </CardHeader>
          <CardContent>
            <SchemaBuilder fields={fields} onChange={setFields} />
          </CardContent>
        </Card>

        <Card className="">
          <CardHeader>
            <CardTitle className="text-lg">Validation Instructions (optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={validationInstructions}
              onChange={(e) => setValidationInstructions(e.target.value)}
              placeholder="Add any special instructions for the AI when extracting data from documents..."
              className="w-full h-32 px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
            />
            <p className="text-xs text-muted-foreground mt-2">
              These instructions help the AI understand context, formatting rules, or edge cases.
            </p>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3 pt-4">
          <Button type="submit" disabled={createDocumentType.isPending}>
            {createDocumentType.isPending ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creating...
              </>
            ) : (
              'Create Document Type'
            )}
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link to="/document-types">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
