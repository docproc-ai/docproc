'use client'

import type React from 'react'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, Plus, ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

// This interface is now shared and defined here
export interface JsonSchema {
  type?: string | string[]
  title?: string
  description?: string
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  required?: string[]
  enum?: any[]
  default?: any
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  format?: 'date' | 'date-time' | 'email' | 'uri'
  'ui:widget'?: 'default' | 'table' | 'textarea'
  ai?: {
    instructions?: string
  }
}

// Helper component for building enum options
function EnumBuilder({ value, onChange }: { value: any[]; onChange: (newValue: any[]) => void }) {
  const handleOptionChange = (index: number, newValue: string) => {
    const newOptions = [...value]
    newOptions[index] = newValue
    onChange(newOptions)
  }

  const addOption = () => {
    onChange([...value, `New Option`])
  }

  const removeOption = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2 pl-6">
      <p className="text-muted-foreground text-sm">
        The form will show a dropdown with these options.
      </p>
      {value.map((option, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={option}
            onChange={(e) => handleOptionChange(index, e.target.value)}
            placeholder={`Option ${index + 1}`}
          />
          <Button variant="ghost" size="icon" onClick={() => removeOption(index)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addOption}>
        <Plus className="h-4 w-4" />
        Add Option
      </Button>
    </div>
  )
}

interface SchemaBuilderProps {
  schema: JsonSchema
  onChange: (schema: JsonSchema) => void
  path?: string
}

export function SchemaBuilder({ schema, onChange, path = '' }: SchemaBuilderProps) {
  const [expandedProperties, setExpandedProperties] = useState<Record<string, boolean>>({})
  const propertyIdMap = useRef(new Map<string, string>())

  const getStableId = (key: string) => {
    if (!propertyIdMap.current.has(key)) {
      propertyIdMap.current.set(key, `prop-${crypto.randomUUID()}`)
    }
    return propertyIdMap.current.get(key)!
  }

  useEffect(() => {
    const currentKeys = new Set(Object.keys(schema.properties || {}))
    for (const key of propertyIdMap.current.keys()) {
      if (!currentKeys.has(key)) {
        propertyIdMap.current.delete(key)
      }
    }
  }, [schema.properties])

  const toggleProperty = (key: string) => {
    setExpandedProperties((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const updateSchema = (updates: Partial<JsonSchema>) => {
    onChange({ ...schema, ...updates })
  }

  const addProperty = () => {
    const newKey = `field_${Object.keys(schema.properties || {}).length + 1}`
    updateSchema({
      properties: {
        ...schema.properties,
        [newKey]: { type: 'string', title: '' },
      },
    })
  }

  const removeProperty = (key: string) => {
    const newProperties = { ...schema.properties }
    delete newProperties[key]
    updateSchema({ properties: newProperties })

    if (propertyIdMap.current.has(key)) {
      propertyIdMap.current.delete(key)
    }
  }

  const updateProperty = (key: string, propertySchema: JsonSchema) => {
    updateSchema({
      properties: {
        ...schema.properties,
        [key]: propertySchema,
      },
    })
  }

  const renameProperty = (oldKey: string, newKey: string) => {
    if (oldKey === newKey || !newKey.trim()) return

    const newProperties: Record<string, JsonSchema> = {}
    for (const currentKey in schema.properties) {
      if (currentKey === oldKey) {
        newProperties[newKey] = schema.properties[currentKey]
      } else {
        newProperties[currentKey] = schema.properties[currentKey]
      }
    }

    const required = schema.required || []
    const newRequired = required.map((key) => (key === oldKey ? newKey : key))

    if (propertyIdMap.current.has(oldKey)) {
      const id = propertyIdMap.current.get(oldKey)!
      propertyIdMap.current.delete(oldKey)
      propertyIdMap.current.set(newKey, id)
    }

    updateSchema({
      properties: newProperties,
      required: newRequired.length > 0 ? newRequired : undefined,
    })
  }

  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [dragOverItem, setDragOverItem] = useState<string | null>(null)

  const handleDragStart = (e: React.DragEvent, key: string) => {
    setDraggedItem(key)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverItem(key)
  }

  const handleDragLeave = () => {
    setDragOverItem(null)
  }

  const handleDrop = (e: React.DragEvent, dropKey: string) => {
    e.preventDefault()

    if (!draggedItem || draggedItem === dropKey) {
      setDraggedItem(null)
      setDragOverItem(null)
      return
    }

    const entries = Object.entries(schema.properties || {})
    const draggedIndex = entries.findIndex(([key]) => key === draggedItem)
    const dropIndex = entries.findIndex(([key]) => key === dropKey)

    if (draggedIndex === -1 || dropIndex === -1) return

    const newEntries = [...entries]
    const [draggedEntry] = newEntries.splice(draggedIndex, 1)
    newEntries.splice(dropIndex, 0, draggedEntry)

    const newProperties = Object.fromEntries(newEntries)

    updateSchema({ properties: newProperties })
    setDraggedItem(null)
    setDragOverItem(null)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDragOverItem(null)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Type</Label>
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
            <SelectTrigger>
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
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            value={schema.title ?? ''}
            onChange={(e) => updateSchema({ title: e.target.value || undefined })}
            placeholder="Field title"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Input
          value={schema.description ?? ''}
          onChange={(e) => updateSchema({ description: e.target.value || undefined })}
          placeholder="Field description"
        />
      </div>

      {schema.type === 'string' && (
        <div className="space-y-4">
          {!Array.isArray(schema.enum) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="format">Format</Label>
                <Select
                  value={schema.format || 'none'}
                  onValueChange={(format) =>
                    updateSchema({ format: format === 'none' ? undefined : (format as any) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="date-time">Date-Time</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="uri">URI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="widget">Widget</Label>
                <Select
                  value={schema['ui:widget'] || 'default'}
                  onValueChange={(widget) =>
                    updateSchema({
                      'ui:widget': widget === 'default' ? undefined : (widget as any),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a widget" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Single Line Input</SelectItem>
                    <SelectItem value="textarea">Multi-line Text Area</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="use-enum-root"
                checked={Array.isArray(schema.enum)}
                onCheckedChange={(checked) => {
                  const newSchema = { ...schema }
                  if (checked) {
                    delete newSchema.format
                    delete newSchema['ui:widget']
                    newSchema.enum = ['Option 1']
                  } else {
                    delete newSchema.enum
                  }
                  updateSchema(newSchema)
                }}
              />
              <Label htmlFor="use-enum-root">Use predefined options (enum)</Label>
            </div>

            {Array.isArray(schema.enum) && (
              <EnumBuilder
                value={schema.enum}
                onChange={(newEnum) => {
                  updateSchema({ ...schema, enum: newEnum })
                }}
              />
            )}
          </div>
        </div>
      )}

      {schema.type === 'object' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Properties</Label>
            <Button variant="outline" size="sm" onClick={addProperty}>
              <Plus className="h-4 w-4" />
              Add Property
            </Button>
          </div>

          {schema.properties &&
            Object.entries(schema.properties).map(([key, propertySchema]) => {
              const isExpanded = expandedProperties[key] || false

              return (
                <Collapsible
                  key={getStableId(key)}
                  open={isExpanded}
                  onOpenChange={() => toggleProperty(key)}
                >
                  <div
                    className={`border-border space-y-4 rounded-lg border p-4 transition-all ${
                      dragOverItem === key ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
                    } ${draggedItem === key ? 'opacity-50' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, key)}
                    onDragOver={(e) => handleDragOver(e, key)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, key)}
                    onDragEnd={handleDragEnd}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex cursor-pointer items-center justify-between gap-4">
                        <div className="flex flex-1 items-center gap-2">
                          <GripVertical className="text-muted-foreground h-4 w-4 cursor-grab active:cursor-grabbing" />
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <Input
                            value={key}
                            onChange={(e) => renameProperty(key, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onFocus={(e) => e.stopPropagation()}
                            className="h-8 flex-1 font-medium"
                            placeholder="Property name"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <Select
                            value={
                              Array.isArray(propertySchema.type)
                                ? propertySchema.type[0]
                                : String(propertySchema.type || 'string')
                            }
                            onValueChange={(type) => {
                              const updates: JsonSchema = { ...propertySchema, type }
                              if (type === 'object' && !propertySchema.properties) {
                                updates.properties = {}
                              }
                              if (type === 'array' && !propertySchema.items) {
                                updates.items = { type: 'string' }
                              }
                              updateProperty(key, updates)
                            }}
                          >
                            <SelectTrigger
                              className="h-8 w-24"
                              onClick={(e) => e.stopPropagation()}
                            >
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
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`required-${getStableId(key)}`}
                              checked={schema.required?.includes(key) || false}
                              onCheckedChange={(checked) => {
                                const required = schema.required || []
                                const newRequired = checked
                                  ? [...required, key]
                                  : required.filter((r) => r !== key)
                                updateSchema({ required: newRequired })
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Label
                              htmlFor={`required-${getStableId(key)}`}
                              className="cursor-pointer text-sm font-medium"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Required
                            </Label>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeProperty(key)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-border space-y-4 border-t pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor={`title-${getStableId(key)}`}>Title</Label>
                            <Input
                              id={`title-${getStableId(key)}`}
                              value={propertySchema.title ?? ''}
                              onChange={(e) =>
                                updateProperty(key, {
                                  ...propertySchema,
                                  title: e.target.value || undefined,
                                })
                              }
                              placeholder="Field title"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`description-${getStableId(key)}`}>Description</Label>
                            <Input
                              id={`description-${getStableId(key)}`}
                              value={propertySchema.description ?? ''}
                              onChange={(e) =>
                                updateProperty(key, {
                                  ...propertySchema,
                                  description: e.target.value || undefined,
                                })
                              }
                              placeholder="Field description"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor={`ai-instructions-${getStableId(key)}`}>
                            AI Instructions
                          </Label>
                          <Input
                            id={`ai-instructions-${getStableId(key)}`}
                            value={propertySchema.ai?.instructions ?? ''}
                            onChange={(e) => {
                              const instructions = e.target.value || undefined
                              const newSchema = { ...propertySchema }
                              if (instructions) {
                                newSchema.ai = { ...newSchema.ai, instructions }
                              } else {
                                if (newSchema.ai) {
                                  delete newSchema.ai.instructions
                                  if (Object.keys(newSchema.ai).length === 0) {
                                    delete newSchema.ai
                                  }
                                }
                              }
                              updateProperty(key, newSchema)
                            }}
                            placeholder="e.g., 'Look for the largest number at the bottom'"
                          />
                        </div>

                        {propertySchema.type === 'string' && (
                          <div className="space-y-4">
                            {!Array.isArray(propertySchema.enum) && (
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor={`format-${getStableId(key)}`}>Format</Label>
                                  <Select
                                    value={propertySchema.format || 'none'}
                                    onValueChange={(format) =>
                                      updateProperty(key, {
                                        ...propertySchema,
                                        format: format === 'none' ? undefined : (format as any),
                                      })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a format" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">None</SelectItem>
                                      <SelectItem value="date">Date</SelectItem>
                                      <SelectItem value="date-time">Date-Time</SelectItem>
                                      <SelectItem value="email">Email</SelectItem>
                                      <SelectItem value="uri">URI</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor={`widget-${getStableId(key)}`}>Widget</Label>
                                  <Select
                                    value={propertySchema['ui:widget'] || 'default'}
                                    onValueChange={(widget) =>
                                      updateProperty(key, {
                                        ...propertySchema,
                                        'ui:widget':
                                          widget === 'default' ? undefined : (widget as any),
                                      })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a widget" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="default">Single Line Input</SelectItem>
                                      <SelectItem value="textarea">Multi-line Text Area</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}

                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`use-enum-${getStableId(key)}`}
                                  checked={Array.isArray(propertySchema.enum)}
                                  onCheckedChange={(checked) => {
                                    const newPropertySchema = { ...propertySchema }
                                    if (checked) {
                                      delete newPropertySchema.format
                                      delete newPropertySchema['ui:widget']
                                      newPropertySchema.enum = ['Option 1']
                                    } else {
                                      delete newPropertySchema.enum
                                    }
                                    updateProperty(key, newPropertySchema)
                                  }}
                                />
                                <Label htmlFor={`use-enum-${getStableId(key)}`}>
                                  Use predefined options (enum)
                                </Label>
                              </div>

                              {Array.isArray(propertySchema.enum) && (
                                <EnumBuilder
                                  value={propertySchema.enum}
                                  onChange={(newEnum) => {
                                    updateProperty(key, { ...propertySchema, enum: newEnum })
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        )}

                        {(propertySchema.type === 'number' ||
                          propertySchema.type === 'integer') && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor={`min-${getStableId(key)}`}>Minimum</Label>
                              <Input
                                id={`min-${getStableId(key)}`}
                                type="number"
                                value={propertySchema.minimum ?? ''}
                                onChange={(e) =>
                                  updateProperty(key, {
                                    ...propertySchema,
                                    minimum: Number(e.target.value),
                                  })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                    e.preventDefault()
                                  }
                                }}
                                placeholder="Minimum value"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`max-${getStableId(key)}`}>Maximum</Label>
                              <Input
                                id={`max-${getStableId(key)}`}
                                type="number"
                                value={propertySchema.maximum ?? ''}
                                onChange={(e) =>
                                  updateProperty(key, {
                                    ...propertySchema,
                                    maximum: Number(e.target.value),
                                  })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                    e.preventDefault()
                                  }
                                }}
                                placeholder="Maximum value"
                              />
                            </div>
                          </div>
                        )}

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
                              onChange={(newSchema) => updateProperty(key, newSchema)}
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
                                  onValueChange={(value) =>
                                    updateProperty(key, {
                                      ...propertySchema,
                                      'ui:widget': value as 'default' | 'table',
                                    })
                                  }
                                >
                                  <SelectTrigger>
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
                              onChange={(newItemsSchema) =>
                                updateProperty(key, { ...propertySchema, items: newItemsSchema })
                              }
                              path={`${path}[]`}
                            />
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )
            })}
        </div>
      )}

      {schema.type === 'array' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Label className="col-span-2 text-base font-semibold">Array Settings</Label>
            <div>
              <Label>Display as</Label>
              <Select
                value={schema['ui:widget'] || 'default'}
                onValueChange={(value) =>
                  updateSchema({ 'ui:widget': value as 'default' | 'table' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">List</SelectItem>
                  <SelectItem value="table">Table</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Label className="text-base font-semibold">Array Items Schema</Label>
          <div className="border-border rounded-lg border p-4">
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
          </div>
        </div>
      )}
    </div>
  )
}
