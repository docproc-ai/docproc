'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { JsonSchema } from './types'

interface NumberFieldBuilderProps {
  schema: JsonSchema
  onChange: (updates: Partial<JsonSchema>) => void
  fieldId: string
}

export function NumberFieldBuilder({ schema, onChange, fieldId }: NumberFieldBuilderProps) {
  if (schema.type !== 'number' && schema.type !== 'integer') return null

  return (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`minimum-${fieldId}`}>Minimum</Label>
            <Input
          id={`min-${fieldId}`}
          type="number"
          value={schema.minimum ?? ''}
          onChange={(e) =>
            onChange({
              minimum: e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
            }
          }}
          placeholder="Minimum value"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`max-${fieldId}`}>Maximum</Label>
        <Input
          id={`max-${fieldId}`}
          type="number"
          value={schema.maximum ?? ''}
          onChange={(e) =>
            onChange({
              maximum: e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
            }
          }}
          placeholder="Maximum value"
        />
      </div>
    </div>
  )
}
