import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import type { JsonSchema } from './types'

interface ArrayFieldBuilderProps {
  schema: JsonSchema
  onChange: (updates: Partial<JsonSchema>) => void
  children: React.ReactNode
}

export function ArrayFieldBuilder({ schema, onChange, children }: ArrayFieldBuilderProps) {
  if (schema.type !== 'array') return null

  const isObjectArray = schema.items?.type === 'object'

  return (
    <div className="space-y-4">
      <FieldLabel className="text-base font-semibold">Array Settings</FieldLabel>
      <Field>
        <FieldLabel>Display as</FieldLabel>
        <Select
          value={schema['ui:widget'] || 'default'}
          onValueChange={(value) => onChange({ 'ui:widget': value as 'default' | 'table' })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">List</SelectItem>
            <SelectItem value="table">Table</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {schema['ui:widget'] === 'table' && (
        <Field>
          <div className="flex items-center gap-2">
            <Checkbox
              id="pivoted"
              checked={schema['ui:pivoted'] ?? false}
              onCheckedChange={(checked) => onChange({ 'ui:pivoted': checked === true })}
            />
            <FieldLabel htmlFor="pivoted" className="!mb-0 cursor-pointer">
              Default to pivoted view
            </FieldLabel>
          </div>
          <FieldDescription>
            Pivoted view shows fields as rows and records as columns
          </FieldDescription>
        </Field>
      )}
      {isObjectArray && schema['ui:widget'] !== 'table' && (
        <Field>
          <FieldLabel htmlFor="displayTemplate">Item Display Template</FieldLabel>
          <FieldDescription>
            Use {`{{fieldName}}`} to reference field values. Example: {`{{firstName}} {{lastName}}`}
          </FieldDescription>
          <Input
            id="displayTemplate"
            value={schema.items?.['ui:displayTemplate'] ?? ''}
            onChange={(e) => {
              const value = e.target.value || undefined
              onChange({
                items: {
                  ...schema.items,
                  'ui:displayTemplate': value,
                },
              })
            }}
            placeholder="e.g., {{name}} - {{email}}"
          />
        </Field>
      )}
      <FieldLabel className="text-base font-semibold">Array Items Schema</FieldLabel>
      <div className="border-border rounded-lg border p-4">{children}</div>
    </div>
  )
}
