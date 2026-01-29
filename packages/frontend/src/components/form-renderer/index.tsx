import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { ArrayField } from './array-field'
import { BooleanField } from './boolean-field'
import { NumberField } from './number-field'
import { ObjectField } from './object-field'
import { StringField } from './string-field'
import type { FormFieldProps, FormRendererProps } from './types'

export function FormRenderer({
  schema,
  data,
  onChange,
  isStreaming,
}: FormRendererProps) {
  if (!schema || !schema.properties) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No schema properties defined</EmptyTitle>
          <EmptyDescription>
            Select a document or define a schema to get started.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  // Normalize data to object type
  const dataObj =
    typeof data === 'object' && data !== null
      ? (data as Record<string, unknown>)
      : {}

  return (
    <div className="space-y-6">
      {Object.entries(schema.properties).map(([key, fieldSchema]) => (
        <div key={key} className="mb-4">
          <FormField
            name={key}
            schema={fieldSchema}
            value={dataObj[key]}
            onChange={(value) => onChange({ ...dataObj, [key]: value })}
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
  const handleChange = (newValue: unknown) => {
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
export type { FormFieldProps, FormRendererProps } from './types'
