'use client'

import { Label } from '@/components/ui/label'
import type { FormFieldProps } from './types'
import { StringField } from './string-field'
import { NumberField } from './number-field'
import { BooleanField } from './boolean-field'
import { ArrayField } from './array-field'

// Forward declaration to avoid circular dependency
function FormField({
  name,
  schema,
  value,
  onChange,
  required,
  isArrayItem = false,
}: FormFieldProps) {
  // Handle enum fields (dropdowns) for any type
  if (schema.enum) {
    return (
      <StringField
        name={name}
        schema={schema}
        value={value}
        onChange={onChange}
        required={required}
        isArrayItem={isArrayItem}
      />
    )
  }

  const fieldType = Array.isArray(schema.type) ? schema.type[0] : schema.type

  // Render based on field type
  switch (fieldType) {
    case 'string':
      return (
        <StringField
          name={name}
          schema={schema}
          value={value}
          onChange={onChange}
          required={required}
          isArrayItem={isArrayItem}
        />
      )
    case 'number':
    case 'integer':
      return (
        <NumberField
          name={name}
          schema={schema}
          value={value}
          onChange={onChange}
          required={required}
          isArrayItem={isArrayItem}
        />
      )
    case 'boolean':
      return (
        <BooleanField
          name={name}
          schema={schema}
          value={value}
          onChange={onChange}
          required={required}
          isArrayItem={isArrayItem}
        />
      )
    case 'object':
      return (
        <ObjectField
          name={name}
          schema={schema}
          value={value}
          onChange={onChange}
          required={required}
          isArrayItem={isArrayItem}
        />
      )
    case 'array':
      return (
        <ArrayField
          name={name}
          schema={schema}
          value={value}
          onChange={onChange}
          required={required}
          isArrayItem={isArrayItem}
        />
      )
    default:
      // Fallback for unknown types - render as string
      return (
        <StringField
          name={name}
          schema={schema}
          value={value}
          onChange={onChange}
          required={required}
          isArrayItem={isArrayItem}
        />
      )
  }
}

export function ObjectField({ name, schema, value, onChange, required, isArrayItem = false }: FormFieldProps) {
  if (schema.type !== 'object') return null

  const objectValue = value || {}

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
          <FormField
            key={key}
            name={key}
            schema={subSchema}
            value={objectValue[key]}
            onChange={(newValue) => onChange({ ...objectValue, [key]: newValue })}
            required={schema.required?.includes(key)}
            isArrayItem={false}
          />
        ))}
    </>
  )

  if (isArrayItem) {
    return <div className="space-y-4">{objectContent}</div>
  }

  return <div className="border-border space-y-4 rounded-lg border p-4">{objectContent}</div>
}
