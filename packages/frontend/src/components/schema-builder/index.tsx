import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { StringFieldBuilder } from './string-field-builder'
import { NumberFieldBuilder } from './number-field-builder'
import { ArrayFieldBuilder } from './array-field-builder'
import { ObjectFieldBuilder } from './object-field-builder'
import type { JsonSchema, SchemaBuilderProps } from './types'

export function SchemaBuilder({ schema, onChange, path = '' }: SchemaBuilderProps) {
  const updateSchema = (updates: Partial<JsonSchema>) => {
    const newSchema = { ...schema }

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
        <Field>
          <FieldLabel htmlFor="type">Type</FieldLabel>
          <Select
            value={Array.isArray(schema.type) ? schema.type[0] : String(schema.type || 'object')}
            onValueChange={(type) => {
              const updates: Partial<JsonSchema> = { type }
              if (type === 'object' && !schema.properties) {
                updates.properties = {}
              }
              if (type === 'array' && !schema.items) {
                updates.items = { type: 'object', properties: {} }
              }
              updateSchema(updates)
            }}
          >
            <SelectTrigger id="type" className="w-full">
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
        </Field>
        <Field>
          <FieldLabel htmlFor="title">Title</FieldLabel>
          <Input
            id="title"
            value={schema.title ?? ''}
            onChange={(e) => updateSchema({ title: e.target.value || undefined })}
            placeholder="Field title"
          />
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="description">Description</FieldLabel>
        <Input
          id="description"
          value={schema.description ?? ''}
          onChange={(e) => updateSchema({ description: e.target.value || undefined })}
          placeholder="Field description"
        />
      </Field>

      <StringFieldBuilder schema={schema} onChange={updateSchema} fieldId={path || 'root'} />

      <NumberFieldBuilder schema={schema} onChange={updateSchema} fieldId={path || 'root'} />

      <ObjectFieldBuilder schema={schema} onChange={updateSchema}>
        {(key, propertySchema, propertyId) => (
          <>
            <StringFieldBuilder
              schema={propertySchema}
              onChange={(updates) => {
                const updatedProperty = { ...propertySchema }

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
              <ObjectFieldBuilder
                schema={{
                  type: 'object',
                  properties: propertySchema.properties || {},
                  required: propertySchema.required || [],
                }}
                onChange={(updates) => {
                  const newProperties = {
                    ...schema.properties,
                    [key]: {
                      ...propertySchema,
                      properties: updates.properties || {},
                      required: updates.required || [],
                    },
                  }
                  updateSchema({ properties: newProperties })
                }}
              >
                {(nestedKey, nestedSchema, nestedId) => (
                  <>
                    <StringFieldBuilder
                      schema={nestedSchema}
                      onChange={(updates) => {
                        const updatedProperty = { ...nestedSchema, ...updates }
                        const newNestedProperties = {
                          ...(propertySchema.properties || {}),
                          [nestedKey]: updatedProperty,
                        }
                        const newProperties = {
                          ...schema.properties,
                          [key]: {
                            ...propertySchema,
                            properties: newNestedProperties,
                          },
                        }
                        updateSchema({ properties: newProperties })
                      }}
                      fieldId={nestedId}
                    />
                    <NumberFieldBuilder
                      schema={nestedSchema}
                      onChange={(updates) => {
                        const updatedProperty = { ...nestedSchema, ...updates }
                        const newNestedProperties = {
                          ...(propertySchema.properties || {}),
                          [nestedKey]: updatedProperty,
                        }
                        const newProperties = {
                          ...schema.properties,
                          [key]: {
                            ...propertySchema,
                            properties: newNestedProperties,
                          },
                        }
                        updateSchema({ properties: newProperties })
                      }}
                      fieldId={nestedId}
                    />
                  </>
                )}
              </ObjectFieldBuilder>
            )}

            {propertySchema.type === 'array' && (
              <div className="border-border rounded-lg border p-4">
                <div className="mb-4 space-y-4">
                  <FieldLabel className="text-sm font-semibold">Array Items Schema</FieldLabel>
                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel>Items Type</FieldLabel>
                      <Select
                        value={propertySchema.items?.type || 'string'}
                        onValueChange={(type) => {
                          const newProperties = {
                            ...schema.properties,
                            [key]: {
                              ...propertySchema,
                              items: {
                                ...propertySchema.items,
                                type,
                                ...(type === 'object' && !propertySchema.items?.properties ? { properties: {} } : {}),
                              },
                            },
                          }
                          updateSchema({ properties: newProperties })
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
                    </Field>
                    <Field>
                      <FieldLabel>Display as</FieldLabel>
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
                    </Field>
                  </div>
                  {propertySchema['ui:widget'] === 'table' && (
                    <Field>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`pivoted-${key}`}
                          checked={propertySchema['ui:pivoted'] ?? false}
                          onCheckedChange={(checked) => {
                            const newProperties = {
                              ...schema.properties,
                              [key]: {
                                ...propertySchema,
                                'ui:pivoted': checked === true,
                              },
                            }
                            updateSchema({ properties: newProperties })
                          }}
                        />
                        <Label htmlFor={`pivoted-${key}`} className="cursor-pointer">
                          Default to pivoted view
                        </Label>
                      </div>
                      <FieldDescription>
                        Pivoted view shows fields as rows and records as columns
                      </FieldDescription>
                    </Field>
                  )}
                </div>
                {propertySchema.items?.type === 'object' && (
                  <ObjectFieldBuilder
                    schema={{
                      type: 'object',
                      properties: propertySchema.items?.properties || {},
                      required: propertySchema.items?.required || [],
                    }}
                    onChange={(updates) => {
                      const newProperties = {
                        ...schema.properties,
                        [key]: {
                          ...propertySchema,
                          items: {
                            ...propertySchema.items,
                            type: 'object',
                            properties: updates.properties || propertySchema.items?.properties || {},
                            required: updates.required || propertySchema.items?.required || [],
                          },
                        },
                      }
                      updateSchema({ properties: newProperties })
                    }}
                  >
                    {(propKey, propSchema, propId) => (
                      <>
                        <StringFieldBuilder
                          schema={propSchema}
                          onChange={(updates) => {
                            const updatedProperty = { ...propSchema }
                            for (const [updateKey, updateValue] of Object.entries(updates)) {
                              if (updateValue === undefined) {
                                delete updatedProperty[updateKey as keyof JsonSchema]
                              } else {
                                ;(updatedProperty as any)[updateKey] = updateValue
                              }
                            }
                            const newItemProperties = {
                              ...(propertySchema.items?.properties || {}),
                              [propKey]: updatedProperty,
                            }
                            const newProperties = {
                              ...schema.properties,
                              [key]: {
                                ...propertySchema,
                                items: {
                                  ...propertySchema.items,
                                  properties: newItemProperties,
                                },
                              },
                            }
                            updateSchema({ properties: newProperties })
                          }}
                          fieldId={propId}
                        />
                        <NumberFieldBuilder
                          schema={propSchema}
                          onChange={(updates) => {
                            const updatedProperty = { ...propSchema }
                            for (const [updateKey, updateValue] of Object.entries(updates)) {
                              if (updateValue === undefined) {
                                delete updatedProperty[updateKey as keyof JsonSchema]
                              } else {
                                ;(updatedProperty as any)[updateKey] = updateValue
                              }
                            }
                            const newItemProperties = {
                              ...(propertySchema.items?.properties || {}),
                              [propKey]: updatedProperty,
                            }
                            const newProperties = {
                              ...schema.properties,
                              [key]: {
                                ...propertySchema,
                                items: {
                                  ...propertySchema.items,
                                  properties: newItemProperties,
                                },
                              },
                            }
                            updateSchema({ properties: newProperties })
                          }}
                          fieldId={propId}
                        />
                      </>
                    )}
                  </ObjectFieldBuilder>
                )}
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
            'ui:displayTemplate': schema.items?.['ui:displayTemplate'],
            ai: schema.items?.ai,
          }}
          onChange={(newItemsSchema) => updateSchema({ items: newItemsSchema })}
          path={`${path}[]`}
        />
      </ArrayFieldBuilder>
    </div>
  )
}

export type { JsonSchema, SchemaBuilderProps } from './types'
