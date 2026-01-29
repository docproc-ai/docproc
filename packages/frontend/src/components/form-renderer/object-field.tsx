import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

function KeyValueRow({
  propertyKey,
  value,
  onKeyChange,
  onValueChange,
  onRemove,
  disabled,
}: {
  propertyKey: string
  value: unknown
  onKeyChange: (newKey: string) => void
  onValueChange: (newValue: unknown) => void
  onRemove: () => void
  disabled?: boolean
}) {
  const [editingKey, setEditingKey] = useState(propertyKey)
  const stringValue = typeof value === 'string' ? value : (value != null ? String(value) : '')

  return (
    <div className="flex items-center gap-2">
      <Input
        type="text"
        value={editingKey}
        onChange={(e) => setEditingKey(e.target.value)}
        onBlur={() => onKeyChange(editingKey)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          }
        }}
        className="w-1/3"
        disabled={disabled}
      />
      <Input
        type="text"
        value={stringValue}
        onChange={(e) => onValueChange(e.target.value)}
        className="flex-1"
        disabled={disabled}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={disabled}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
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
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')

  if (schema.type !== 'object') return null

  // Normalize value to object type
  const objectValue: Record<string, unknown> = (typeof value === 'object' && value !== null)
    ? value as Record<string, unknown>
    : {}

  // Get defined property keys
  const definedKeys = new Set(Object.keys(schema.properties || {}))

  // Find additional keys (in value but not in schema)
  const additionalKeys = Object.keys(objectValue).filter(key => !definedKeys.has(key))

  // Check if additional properties are explicitly enabled (for adding new ones)
  const allowsAddingProperties = schema.additionalProperties === true || typeof schema.additionalProperties === 'object'

  const handleAddProperty = () => {
    if (!newKeyName.trim()) return
    const key = newKeyName.trim()
    if (definedKeys.has(key) || objectValue[key] !== undefined) return
    onChange({ ...objectValue, [key]: newKeyValue })
    setNewKeyName('')
    setNewKeyValue('')
  }

  const handleRenameProperty = (oldKey: string, newKey: string) => {
    if (!newKey.trim() || oldKey === newKey.trim()) return
    const trimmedKey = newKey.trim()
    if (definedKeys.has(trimmedKey) || (objectValue[trimmedKey] !== undefined && trimmedKey !== oldKey)) return
    const newValue = { ...objectValue }
    const val = newValue[oldKey]
    delete newValue[oldKey]
    newValue[trimmedKey] = val
    onChange(newValue)
  }

  const handleRemoveAdditionalProperty = (key: string) => {
    const newValue = { ...objectValue }
    delete newValue[key]
    onChange(newValue)
  }

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
      {additionalKeys.length > 0 && (
        <div className="space-y-2">
          {additionalKeys.map((key) => (
            <KeyValueRow
              key={key}
              propertyKey={key}
              value={objectValue[key]}
              onKeyChange={(newKey) => handleRenameProperty(key, newKey)}
              onValueChange={(newValue) =>
                onChange({ ...objectValue, [key]: newValue })
              }
              onRemove={() => handleRemoveAdditionalProperty(key)}
              disabled={isStreaming}
            />
          ))}
        </div>
      )}
      {allowsAddingProperties && !isStreaming && (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="Property"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddProperty()
              }
            }}
            className="w-1/3"
          />
          <Input
            type="text"
            placeholder="Value"
            value={newKeyValue}
            onChange={(e) => setNewKeyValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddProperty()
              }
            }}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAddProperty}
            disabled={!newKeyName.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  )

  if (isArrayItem) {
    return <div className="space-y-4">{objectContent}</div>
  }

  return <Field>{objectContent}</Field>
}
