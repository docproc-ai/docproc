import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import type { FormFieldProps } from './types'
import { StringField } from './string-field'
import { NumberField } from './number-field'
import { BooleanField } from './boolean-field'
import { ArrayField } from './array-field'
import type { JsonSchema } from '../schema-builder/types'

// Forward declaration to avoid circular dependency
function FormField({
  name,
  schema,
  value,
  onChange,
  required,
  isArrayItem = false,
  isStreaming = false,
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
          onChange={onChange}
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
          onChange={onChange}
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
          onChange={onChange}
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
          onChange={onChange}
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
          onChange={onChange}
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
          schema={schema}
          value={value}
          onChange={onChange}
          required={required}
          isArrayItem={isArrayItem}
          isStreaming={isStreaming}
        />
      )
  }
}

export function ObjectField({
  name,
  schema,
  value,
  onChange,
  required,
  isArrayItem = false,
  isStreaming,
}: FormFieldProps) {
  if (schema.type !== 'object') return null

  // Normalize value to object type
  const objectValue: Record<string, unknown> = (typeof value === 'object' && value !== null)
    ? value as Record<string, unknown>
    : {}

  const objectContent = (
    <>
      {!isArrayItem && (
        <div>
          <FieldLabel>
            {schema.title || name}
            {required && <span className="ml-1 text-red-500">*</span>}
          </FieldLabel>
          {schema.description && (
            <FieldDescription>{schema.description}</FieldDescription>
          )}
        </div>
      )}
      {schema.properties &&
        Object.entries(schema.properties).map(([key, subSchema]) => (
          <FormField
            key={key}
            name={key}
            schema={subSchema as JsonSchema}
            value={objectValue[key]}
            onChange={(newValue) =>
              onChange({ ...objectValue, [key]: newValue })
            }
            required={schema.required?.includes(key)}
            isArrayItem={false}
            isStreaming={isStreaming}
          />
        ))}
    </>
  )

  if (isArrayItem) {
    return <div className="space-y-4">{objectContent}</div>
  }

  return <Field>{objectContent}</Field>
}
