'use client'

import { StringField } from './string-field'
import { NumberField } from './number-field'
import { BooleanField } from './boolean-field'
import { ArrayField } from './array-field'
import { ObjectField } from './object-field'
import type { FormRendererProps, FormFieldProps } from './types'

export function FormRenderer({ schema, data, onChange, isStreaming }: FormRendererProps) {
  if (!schema || !schema.properties) {
    return (
      <div className="text-muted-foreground p-8 text-center">
        <p>No schema properties defined.</p>
        <p className="text-sm">Select a document or define a schema to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {Object.entries(schema.properties).map(([key, fieldSchema]) => (
        <div key={key} className="mb-4">
          <FormField
            name={key}
            schema={fieldSchema}
            value={data?.[key]}
            onChange={(value) => onChange({ ...data, [key]: value })}
            required={schema.required?.includes(key)}
            isStreaming={isStreaming}
          />
        </div>
      ))}
    </div>
  )
}

function FormField({
  name,
  schema,
  value,
  onChange,
  required,
  isArrayItem = false,
  isStreaming = false,
}: FormFieldProps) {
  const handleChange = (newValue: any) => {
    onChange(newValue)
  }

  // Handle enum fields (dropdowns) for any type
  if (schema.enum) {
    return (
      <StringField
        name={name}
        schema={schema}
        value={value}
        onChange={handleChange}
        required={required}
        isArrayItem={isArrayItem}
        isStreaming={isStreaming}
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
          onChange={handleChange}
          required={required}
          isArrayItem={isArrayItem}
          isStreaming={isStreaming}
        />
      )
    case 'number':
    case 'integer':
      return (
        <NumberField
          name={name}
          schema={schema}
          value={value}
          onChange={handleChange}
          required={required}
          isArrayItem={isArrayItem}
          isStreaming={isStreaming}
        />
      )
    case 'boolean':
      return (
        <BooleanField
          name={name}
          schema={schema}
          value={value}
          onChange={handleChange}
          required={required}
          isArrayItem={isArrayItem}
          isStreaming={isStreaming}
        />
      )
    case 'object':
      return (
        <ObjectField
          name={name}
          schema={schema}
          value={value}
          onChange={handleChange}
          required={required}
          isArrayItem={isArrayItem}
          isStreaming={isStreaming}
        />
      )
    case 'array':
      return (
        <ArrayField
          name={name}
          schema={schema}
          value={value}
          onChange={handleChange}
          required={required}
          isArrayItem={isArrayItem}
          isStreaming={isStreaming}
        />
      )
    default:
      // Fallback for unknown types - render as string
      return (
        <StringField
          name={name}
          schema={{ ...schema, type: 'string' }}
          value={value}
          onChange={handleChange}
          required={required}
          isArrayItem={isArrayItem}
          isStreaming={isStreaming}
        />
      )
  }
}

// Re-export types for convenience
export type { FormRendererProps, FormFieldProps } from './types'
