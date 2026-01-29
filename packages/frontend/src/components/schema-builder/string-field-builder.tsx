import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EnumBuilder } from './enum-builder'
import type { JsonSchema } from './types'

interface StringFieldBuilderProps {
  schema: JsonSchema
  onChange: (updates: Partial<JsonSchema>) => void
  fieldId: string
}

export function StringFieldBuilder({
  schema,
  onChange,
  fieldId,
}: StringFieldBuilderProps) {
  if (schema.type !== 'string') return null

  return (
    <div className="space-y-4">
      {!Array.isArray(schema.enum) && (
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor={`format-${fieldId}`}>Format</FieldLabel>
            <Select
              value={schema.format || 'none'}
              onValueChange={(format) =>
                onChange({
                  format:
                    format === 'none'
                      ? undefined
                      : (format as JsonSchema['format']),
                })
              }
            >
              <SelectTrigger id={`format-${fieldId}`} className="w-full">
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
          </Field>
          <Field>
            <FieldLabel htmlFor={`widget-${fieldId}`}>Widget</FieldLabel>
            <Select
              value={schema['ui:widget'] || 'default'}
              onValueChange={(widget) =>
                onChange({
                  'ui:widget':
                    widget === 'default'
                      ? undefined
                      : (widget as JsonSchema['ui:widget']),
                })
              }
            >
              <SelectTrigger id={`widget-${fieldId}`} className="w-full">
                <SelectValue placeholder="Select a widget" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Single Line Input</SelectItem>
                <SelectItem value="textarea">Multi-line Text Area</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}

      <Field orientation="horizontal">
        <Checkbox
          id={`use-enum-${fieldId}`}
          checked={Array.isArray(schema.enum)}
          onCheckedChange={(checked) => {
            if (checked) {
              onChange({
                format: undefined,
                'ui:widget': undefined,
                enum: ['Option 1'],
              })
            } else {
              onChange({
                enum: undefined,
              })
            }
          }}
        />
        <FieldLabel htmlFor={`use-enum-${fieldId}`}>
          Use predefined options (enum)
        </FieldLabel>
      </Field>

      {Array.isArray(schema.enum) && (
        <EnumBuilder
          value={schema.enum}
          onChange={(newEnum) => {
            onChange({ enum: newEnum })
          }}
        />
      )}
    </div>
  )
}
