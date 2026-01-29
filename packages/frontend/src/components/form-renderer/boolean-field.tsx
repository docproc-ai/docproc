import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import type { FormFieldProps } from './types'

export function BooleanField({
  name,
  schema,
  value,
  onChange,
  required,
  isArrayItem,
  isStreaming,
}: FormFieldProps) {
  if (schema.type !== 'boolean') return null

  const checkbox = (
    <Checkbox
      id={name}
      checked={typeof value === 'boolean' ? value : false}
      onCheckedChange={onChange}
      disabled={isStreaming}
    />
  )

  if (isArrayItem) return checkbox

  return (
    <Field orientation="horizontal">
      {checkbox}
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={name}>
          {schema.title || name}
          {required && <span className="ml-1 text-red-500">*</span>}
        </FieldLabel>
        {schema.description && (
          <FieldDescription>{schema.description}</FieldDescription>
        )}
      </div>
    </Field>
  )
}
