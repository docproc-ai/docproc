'use client'

import { Label } from '@/components/ui/label'
import type { FormFieldProps } from './types'

export function ObjectField({ name, schema, value, onChange, required, isArrayItem = false }: FormFieldProps) {
  if (schema.type !== 'object') return null

  const objectContent = (
    <>
      {!isArrayItem && (
        <div>
          <Label className="text-base font-semibold">
            {schema.title || name}
            {required && <span className="ml-1 text-red-500">*</span>}
          </Label>
          {schema.description && (
            <p className="text-muted-foreground mt-1 text-sm">{schema.description}</p>
          )}
        </div>
      )}
      {schema.properties &&
        Object.entries(schema.properties).map(([key, subSchema]) => (
          <div key={key} className="space-y-2">
            {/* This would need to be replaced with the actual FormField component */}
            <div className="text-muted-foreground text-sm">
              Object property "{key}" would go here
            </div>
          </div>
        ))}
    </>
  )

  if (isArrayItem) {
    return <div className="space-y-4">{objectContent}</div>
  }

  return <div className="border-border space-y-4 rounded-lg border p-4">{objectContent}</div>
}
