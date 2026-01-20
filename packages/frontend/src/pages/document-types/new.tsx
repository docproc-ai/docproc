import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateDocumentType } from '@/lib/queries'

export default function NewDocumentTypePage() {
  const navigate = useNavigate()
  const createDocumentType = useCreateDocumentType()

  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    try {
      const result = await createDocumentType.mutateAsync({
        name,
        schema: { type: 'object', properties: {}, required: [] },
      })

      // Redirect to settings to configure the schema and other options
      navigate({
        to: '/document-types/$slug/settings',
        params: { slug: result.slug },
      })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create document type',
      )
    }
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-md">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link
          to="/document-types"
          className="hover:text-foreground transition-colors"
        >
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
          Give your document type a name, then configure its schema.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Invoice, Receipt, Contract"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            A human-readable name for this document type.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={createDocumentType.isPending}>
            {createDocumentType.isPending ? 'Creating...' : 'Continue'}
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link to="/document-types">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
