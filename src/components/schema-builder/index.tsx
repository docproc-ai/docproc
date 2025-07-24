'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StringFieldBuilder } from './string-field-builder'
import { NumberFieldBuilder } from './number-field-builder'
import { ArrayFieldBuilder } from './array-field-builder'
import { ObjectFieldBuilder } from './object-field-builder'
import type { JsonSchema, SchemaBuilderProps } from './types'

export function SchemaBuilder({ schema, onChange, path = '' }: SchemaBuilderProps) {
  const updateSchema = (updates: Partial<JsonSchema>) => {
    const newSchema = { ...schema }

    // Apply updates and remove properties that are set to undefined
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) {
        delete newSchema[key as keyof JsonSchema]
      } else {
        ;(newSchema as any)[key] = value
      }
    }

    onChange(newSchema)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">
            Type
          </Label>
          <Select
            value={Array.isArray(schema.type) ? schema.type[0] : String(schema.type || 'object')}
            onValueChange={(type) => {
              const updates: Partial<JsonSchema> = { type }
              if (type === 'object' && !schema.properties) {
                updates.properties = {}
              }
              if (type === 'array' && !schema.items) {
                updates.items = { type: 'string' }
              }
              updateSchema(updates)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">String</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="integer">Integer</SelectItem>
              <SelectItem value="boolean">Boolean</SelectItem>
              <SelectItem value="object">Object</SelectItem>
              <SelectItem value="array">Array</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">
            Title
          </Label>
          <Input
            id="title"
            value={schema.title ?? ''}
            onChange={(e) => updateSchema({ title: e.target.value || undefined })}
            placeholder="Field title"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">
          Description
        </Label>
        <Input
          value={schema.description ?? ''}
          onChange={(e) => updateSchema({ description: e.target.value || undefined })}
          placeholder="Field description"
        />
      </div>

      <StringFieldBuilder schema={schema} onChange={updateSchema} fieldId={path || 'root'} />

      <NumberFieldBuilder schema={schema} onChange={updateSchema} fieldId={path || 'root'} />

      <ObjectFieldBuilder schema={schema} onChange={updateSchema}>
        {(key, propertySchema, propertyId) => (
          <>
            <StringFieldBuilder
              schema={propertySchema}
              onChange={(updates) => {
                const updatedProperty = { ...propertySchema }

                // Apply updates and remove properties that are set to undefined
                for (const [updateKey, updateValue] of Object.entries(updates)) {
                  if (updateValue === undefined) {
                    delete updatedProperty[updateKey as keyof JsonSchema]
                  } else {
                    ;(updatedProperty as any)[updateKey] = updateValue
                  }
                }

                const newProperties = {
                  ...schema.properties,
                  [key]: updatedProperty,
                }
                updateSchema({ properties: newProperties })
              }}
              fieldId={propertyId}
            />

            <NumberFieldBuilder
              schema={propertySchema}
              onChange={(updates) => {
                const updatedProperty = { ...propertySchema }

                // Apply updates and remove properties that are set to undefined
                for (const [updateKey, updateValue] of Object.entries(updates)) {
                  if (updateValue === undefined) {
                    delete updatedProperty[updateKey as keyof JsonSchema]
                  } else {
                    ;(updatedProperty as any)[updateKey] = updateValue
                  }
                }

                const newProperties = {
                  ...schema.properties,
                  [key]: updatedProperty,
                }
                updateSchema({ properties: newProperties })
              }}
              fieldId={propertyId}
            />

            {propertySchema.type === 'object' && (
              <div className="border-border rounded-lg border p-4">
                <Label className="mb-4 block text-sm font-semibold">
                  Nested Properties
                </Label>
                <SchemaBuilder
                  schema={{
                    ...propertySchema,
                    properties: propertySchema.properties || {},
                  }}
                  onChange={(newSchema) => {
                    const newProperties = {
                      ...schema.properties,
                      [key]: newSchema,
                    }
                    updateSchema({ properties: newProperties })
                  }}
                  path={`${path}.${key}`}
                />
              </div>
            )}

            {propertySchema.type === 'array' && (
              <div className="border-border rounded-lg border p-4">
                <div className="mb-4 grid grid-cols-2 gap-4">
                  <Label className="col-span-2 text-sm font-semibold">
                    Array Items Schema
                  </Label>
                  <div>
                    <Label>Display as</Label>
                    <Select
                      value={propertySchema['ui:widget'] || 'default'}
                      onValueChange={(value) => {
                        const newProperties = {
                          ...schema.properties,
                          [key]: {
                            ...propertySchema,
                            'ui:widget': value as 'default' | 'table',
                          },
                        }
                        updateSchema({ properties: newProperties })
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">List</SelectItem>
                        <SelectItem value="table">Table</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <SchemaBuilder
                  schema={{
                    type: propertySchema.items?.type || 'string',
                    title: propertySchema.items?.title,
                    description: propertySchema.items?.description,
                    properties:
                      propertySchema.items?.type === 'object'
                        ? propertySchema.items?.properties || {}
                        : undefined,
                    items:
                      propertySchema.items?.type === 'array'
                        ? propertySchema.items?.items
                        : undefined,
                    required: propertySchema.items?.required || [],
                    minimum: propertySchema.items?.minimum,
                    maximum: propertySchema.items?.maximum,
                    minLength: propertySchema.items?.minLength,
                    maxLength: propertySchema.items?.maxLength,
                    enum: propertySchema.items?.enum,
                    default: propertySchema.items?.default,
                    ai: propertySchema.items?.ai,
                  }}
                  onChange={(newItemsSchema) => {
                    const newProperties = {
                      ...schema.properties,
                      [key]: { ...propertySchema, items: newItemsSchema },
                    }
                    updateSchema({ properties: newProperties })
                  }}
                  path={`${path}[]`}
                />
              </div>
            )}
          </>
        )}
      </ObjectFieldBuilder>

      <ArrayFieldBuilder schema={schema} onChange={updateSchema}>
        <SchemaBuilder
          schema={{
            type: schema.items?.type || 'string',
            title: schema.items?.title,
            description: schema.items?.description,
            properties:
              schema.items?.type === 'object' ? schema.items?.properties || {} : undefined,
            items: schema.items?.type === 'array' ? schema.items?.items : undefined,
            required: schema.items?.required || [],
            minimum: schema.items?.minimum,
            maximum: schema.items?.maximum,
            minLength: schema.items?.minLength,
            maxLength: schema.items?.maxLength,
            enum: schema.items?.enum,
            default: schema.items?.default,
            format: schema.items?.format,
            ai: schema.items?.ai,
          }}
          onChange={(newItemsSchema) => updateSchema({ items: newItemsSchema })}
          path={`${path}[]`}
        />
      </ArrayFieldBuilder>
    </div>
  )
}

// Re-export types for convenience
export type { JsonSchema, SchemaBuilderProps } from './types'
