'use client'

import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import type { FormFieldProps } from './types'

export function NumberField({ name, schema, value, onChange, required, isStreaming }: FormFieldProps) {
  if (schema.type !== 'number' && schema.type !== 'integer') return null

  const fieldType = schema.type
  // Display formatted value with locale (commas for thousands)
  const displayValue = typeof value === 'number' ? value.toLocaleString() : (value ?? '')

  return (
    <Field>
      <FieldLabel htmlFor={name}>
        {schema.title || name}
        {required && <span className="ml-1 text-red-500">*</span>}
      </FieldLabel>
      {schema.description && <FieldDescription>{schema.description}</FieldDescription>}
      <Input
        id={name}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.-]/g, '')
          if (raw === '' || raw === '-') {
            onChange(raw === '-' ? raw : undefined)
            return
          }
          const parsed = fieldType === 'integer' ? Number.parseInt(raw) : Number.parseFloat(raw)
          if (!Number.isNaN(parsed)) {
            onChange(parsed)
          }
        }}
        onWheel={(e) => e.currentTarget.blur()}
        min={schema.minimum}
        max={schema.maximum}
        className=""
        disabled={isStreaming}
      />
    </Field>
  )
}
