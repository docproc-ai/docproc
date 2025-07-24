'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { EnumBuilder } from './enum-builder'
import type { JsonSchema } from './types'

interface StringFieldBuilderProps {
  schema: JsonSchema
  onChange: (updates: Partial<JsonSchema>) => void
  fieldId: string
}

export function StringFieldBuilder({ schema, onChange, fieldId }: StringFieldBuilderProps) {
  if (schema.type !== 'string') return null

  return (
    <div className="space-y-4">
      {!Array.isArray(schema.enum) && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`format-${fieldId}`}>Format</Label>
            <Select
              value={schema.format || 'none'}
              onValueChange={(format) =>
                onChange({ format: format === 'none' ? undefined : (format as any) })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="date-time">Date-Time</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="uri">URI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`widget-${fieldId}`}>Widget</Label>
            <Select
              value={schema['ui:widget'] || 'default'}
              onValueChange={(widget) =>
                onChange({
                  'ui:widget': widget === 'default' ? undefined : (widget as any),
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a widget" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Single Line Input</SelectItem>
                <SelectItem value="textarea">Multi-line Text Area</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id={`use-enum-${fieldId}`}
            checked={Array.isArray(schema.enum)}
            onCheckedChange={(checked) => {
              if (checked) {
                onChange({
                  format: undefined,
                  'ui:widget': undefined,
                  enum: ['Option 1']
                })
              } else {
                onChange({
                  enum: undefined
                })
              }
            }}
          />
          <Label htmlFor={`use-enum-${fieldId}`}>Use predefined options (enum)</Label>
        </div>

        {Array.isArray(schema.enum) && (
          <EnumBuilder
            value={schema.enum}
            onChange={(newEnum) => {
              onChange({ enum: newEnum })
            }}
          />
        )}
      </div>
    </div>
  )
}
