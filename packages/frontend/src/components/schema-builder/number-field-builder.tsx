import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import type { JsonSchema } from './types'

interface NumberFieldBuilderProps {
  schema: JsonSchema
  onChange: (updates: Partial<JsonSchema>) => void
  fieldId: string
}

export function NumberFieldBuilder({
  schema,
  onChange,
  fieldId,
}: NumberFieldBuilderProps) {
  if (schema.type !== 'number' && schema.type !== 'integer') return null

  return (
    <div className="grid grid-cols-2 gap-4">
      <Field>
        <FieldLabel htmlFor={`minimum-${fieldId}`}>Minimum</FieldLabel>
        <Input
          id={`minimum-${fieldId}`}
          type="number"
          value={schema.minimum ?? ''}
          onChange={(e) =>
            onChange({
              minimum:
                e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
            }
          }}
          placeholder="Minimum value"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`maximum-${fieldId}`}>Maximum</FieldLabel>
        <Input
          id={`maximum-${fieldId}`}
          type="number"
          value={schema.maximum ?? ''}
          onChange={(e) =>
            onChange({
              maximum:
                e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
            }
          }}
          placeholder="Maximum value"
        />
      </Field>
    </div>
  )
}
