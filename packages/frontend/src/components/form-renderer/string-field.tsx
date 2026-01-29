import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { FormFieldProps } from './types'

export function StringField({
  name,
  schema,
  value,
  onChange,
  required,
  isArrayItem,
  isStreaming,
}: FormFieldProps) {
  const fieldType = Array.isArray(schema.type) ? schema.type[0] : schema.type
  // Convert value to string for form controls
  const stringValue =
    typeof value === 'string' ? value : value != null ? String(value) : ''

  // Handle enums for any type, not just strings
  if (schema.enum) {
    const select = (
      <Select
        value={String(value ?? '')}
        onValueChange={onChange}
        disabled={isStreaming}
      >
        <SelectTrigger id={name}>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          {schema.enum.map((option, index) => (
            <SelectItem key={index} value={String(option)}>
              {String(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )

    if (isArrayItem) return select

    return (
      <Field>
        <FieldLabel htmlFor={name}>
          {schema.title || name}
          {required && <span className="ml-1 text-red-500">*</span>}
        </FieldLabel>
        {schema.description && (
          <FieldDescription>{schema.description}</FieldDescription>
        )}
        {select}
      </Field>
    )
  }

  // Only render string fields if not an enum
  if (fieldType !== 'string') return null

  if (schema['ui:widget'] === 'textarea') {
    const textarea = (
      <Textarea
        id={name}
        value={stringValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          schema.default != null ? String(schema.default) : undefined
        }
        rows={4}
        disabled={isStreaming}
      />
    )

    if (isArrayItem) return textarea

    return (
      <Field>
        <FieldLabel htmlFor={name}>
          {schema.title || name}
          {required && <span className="ml-1 text-red-500">*</span>}
        </FieldLabel>
        {schema.description && (
          <FieldDescription>{schema.description}</FieldDescription>
        )}
        {textarea}
      </Field>
    )
  }

  if (schema.format === 'date') {
    const input = (
      <Input
        id={name}
        type={isStreaming ? 'text' : 'date'}
        value={stringValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          schema.default != null ? String(schema.default) : undefined
        }
        disabled={isStreaming}
      />
    )

    if (isArrayItem) return input

    return (
      <Field>
        <FieldLabel htmlFor={name}>
          {schema.title || name}
          {required && <span className="ml-1 text-red-500">*</span>}
        </FieldLabel>
        {schema.description && (
          <FieldDescription>{schema.description}</FieldDescription>
        )}
        {input}
      </Field>
    )
  }

  const input = (
    <Input
      id={name}
      type="text"
      value={stringValue}
      onChange={(e) => onChange(e.target.value)}
      placeholder={schema.default != null ? String(schema.default) : undefined}
      disabled={isStreaming}
    />
  )

  if (isArrayItem) return input

  return (
    <Field>
      <FieldLabel htmlFor={name}>
        {schema.title || name}
        {required && <span className="ml-1 text-red-500">*</span>}
      </FieldLabel>
      {schema.description && (
        <FieldDescription>{schema.description}</FieldDescription>
      )}
      {input}
    </Field>
  )
}
