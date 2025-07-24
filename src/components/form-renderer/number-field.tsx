'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FormFieldProps } from './types'

export function NumberField({ name, schema, value, onChange, required }: FormFieldProps) {
  if (schema.type !== 'number' && schema.type !== 'integer') return null

  const fieldType = schema.type

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {schema.title || name}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {schema.description && (
        <p className="text-muted-foreground text-sm">{schema.description}</p>
      )}
      <Input
        id={name}
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const val = e.target.value
          if (val === '') {
            onChange(undefined)
          } else {
            onChange(
              fieldType === 'integer' ? Number.parseInt(val) : Number.parseFloat(val),
            )
          }
        }}
        onWheel={(e) => e.currentTarget.blur()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
          }
        }}
        min={schema.minimum}
        max={schema.maximum}
        className="[-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
  )
}
