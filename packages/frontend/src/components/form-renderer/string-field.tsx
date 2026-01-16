import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import type { FormFieldProps } from './types'

export function StringField({
  name,
  schema,
  value,
  onChange,
  required,
  isStreaming,
}: FormFieldProps) {
  const fieldType = Array.isArray(schema.type) ? schema.type[0] : schema.type

  // Handle enums for any type, not just strings
  if (schema.enum) {
    return (
      <Field>
        <FieldLabel htmlFor={name}>
          {schema.title || name}
          {required && <span className="ml-1 text-red-500">*</span>}
        </FieldLabel>
        {schema.description && <FieldDescription>{schema.description}</FieldDescription>}
        <Select value={String(value ?? '')} onValueChange={onChange} disabled={isStreaming}>
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
      </Field>
    )
  }

  // Only render string fields if not an enum
  if (fieldType !== 'string') return null

  if (schema['ui:widget'] === 'textarea') {
    return (
      <Field>
        <FieldLabel htmlFor={name}>
          {schema.title || name}
          {required && <span className="ml-1 text-red-500">*</span>}
        </FieldLabel>
        {schema.description && <FieldDescription>{schema.description}</FieldDescription>}
        <Textarea
          id={name}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={schema.default}
          rows={4}
          disabled={isStreaming}
        />
      </Field>
    )
  }

  if (schema.format === 'date') {
    return (
      <Field>
        <FieldLabel htmlFor={name}>
          {schema.title || name}
          {required && <span className="ml-1 text-red-500">*</span>}
        </FieldLabel>
        {schema.description && <FieldDescription>{schema.description}</FieldDescription>}
        <Input
          id={name}
          type={isStreaming ? 'text' : 'date'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={schema.default}
          disabled={isStreaming}
        />
      </Field>
    )
  }

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
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={schema.default}
        disabled={isStreaming}
      />
    </Field>
  )
}
