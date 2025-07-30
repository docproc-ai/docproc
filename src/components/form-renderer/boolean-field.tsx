'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { FormFieldProps } from './types'

export function BooleanField({ name, schema, value, onChange, required, isStreaming }: FormFieldProps) {
  if (schema.type !== 'boolean') return null

  return (
    <div className="flex items-center space-x-2">
      <Checkbox id={name} checked={value || false} onCheckedChange={onChange} disabled={isStreaming} />
      <Label htmlFor={name}>
        {schema.title || name}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {schema.description && (
        <p className="text-muted-foreground ml-2 text-sm">{schema.description}</p>
      )}
    </div>
  )
}
