'use client'

import Editor from '@/components/editor'
import { StringField } from './string-field'
import { NumberField } from './number-field'
import { BooleanField } from './boolean-field'
import { ArrayField } from './array-field'
import { ObjectField } from './object-field'
import type { FormRendererProps, FormFieldProps } from './types'

export function FormRenderer({ schema, data, onChange }: FormRendererProps) {
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
      />
    )
  }

  // Render based on field type
  return (
    <>
      <StringField
        name={name}
        schema={schema}
        value={value}
        onChange={handleChange}
        required={required}
        isArrayItem={isArrayItem}
      />

      <NumberField
        name={name}
        schema={schema}
        value={value}
        onChange={handleChange}
        required={required}
        isArrayItem={isArrayItem}
      />

      <BooleanField
        name={name}
        schema={schema}
        value={value}
        onChange={handleChange}
        required={required}
        isArrayItem={isArrayItem}
      />

      <ObjectField
        name={name}
        schema={schema}
        value={value}
        onChange={handleChange}
        required={required}
        isArrayItem={isArrayItem}
      />

      <ArrayField
        name={name}
        schema={schema}
        value={value}
        onChange={handleChange}
        required={required}
        isArrayItem={isArrayItem}
      />

      {/* Fallback for unknown types */}
      {!['string', 'number', 'integer', 'boolean', 'object', 'array'].includes(
        Array.isArray(schema.type) ? schema.type[0] : String(schema.type || ''),
      ) && (
        <div className="space-y-2">
          <label className="text-base font-semibold">
            {schema.title || name}
            {required && <span className="ml-1 text-red-500">*</span>}
          </label>
          {schema.description && (
            <p className="text-muted-foreground text-sm">{schema.description}</p>
          )}
          <Editor language="text" value={String(value ?? '')} onChange={handleChange} />
        </div>
      )}
    </>
  )
}

// Re-export types for convenience
export type { FormRendererProps, FormFieldProps } from './types'
