'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import { FieldBuilder } from './field-builder'
import type { JsonSchema } from './types'

interface ObjectFieldBuilderProps {
  schema: JsonSchema
  onChange: (updates: Partial<JsonSchema>) => void
  children: (key: string, propertySchema: JsonSchema, propertyId: string) => React.ReactNode
}

export function ObjectFieldBuilder({ schema, onChange, children }: ObjectFieldBuilderProps) {
  const [expandedProperties, setExpandedProperties] = useState<Record<string, boolean>>({})
  const propertyIdMap = useRef(new Map<string, string>())
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [dragOverItem, setDragOverItem] = useState<string | null>(null)

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

  const addProperty = () => {
    const newKey = `field_${Object.keys(schema.properties || {}).length + 1}`
    onChange({
      properties: {
        ...schema.properties,
        [newKey]: { type: 'string', title: '' },
      },
    })
  }

  const removeProperty = (key: string) => {
    const newProperties = { ...schema.properties }
    delete newProperties[key]
    onChange({ properties: newProperties })

    if (propertyIdMap.current.has(key)) {
      propertyIdMap.current.delete(key)
    }
  }

  const updateProperty = (key: string, propertySchema: JsonSchema) => {
    onChange({
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

    onChange({
      properties: newProperties,
      required: newRequired.length > 0 ? newRequired : undefined,
    })
  }

  const handleTypeChange = (key: string, type: string) => {
    const propertySchema = schema.properties?.[key]
    if (!propertySchema) return

    const updates: JsonSchema = { ...propertySchema, type }
    if (type === 'object' && !propertySchema.properties) {
      updates.properties = {}
    }
    if (type === 'array' && !propertySchema.items) {
      updates.items = { type: 'string' }
    }
    updateProperty(key, updates)
  }

  const handleRequiredChange = (key: string, required: boolean) => {
    const currentRequired = schema.required || []
    const newRequired = required
      ? [...currentRequired, key]
      : currentRequired.filter((r) => r !== key)
    onChange({ required: newRequired })
  }

  const handleTitleChange = (key: string, title: string) => {
    const propertySchema = schema.properties?.[key]
    if (!propertySchema) return
    updateProperty(key, {
      ...propertySchema,
      title: title || undefined,
    })
  }

  const handleDescriptionChange = (key: string, description: string) => {
    const propertySchema = schema.properties?.[key]
    if (!propertySchema) return
    updateProperty(key, {
      ...propertySchema,
      description: description || undefined,
    })
  }

  const handleAiInstructionsChange = (key: string, instructions: string) => {
    const propertySchema = schema.properties?.[key]
    if (!propertySchema) return

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
  }

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

    onChange({ properties: newProperties })
    setDraggedItem(null)
    setDragOverItem(null)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDragOverItem(null)
  }

  if (schema.type !== 'object') return null

  return (
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
          const propertyId = getStableId(key)

          return (
            <FieldBuilder
              key={propertyId}
              propertyKey={key}
              propertySchema={propertySchema}
              propertyId={propertyId}
              isExpanded={isExpanded}
              onToggle={() => toggleProperty(key)}
              onRename={renameProperty}
              onRemove={removeProperty}
              onTypeChange={handleTypeChange}
              onRequiredChange={handleRequiredChange}
              onTitleChange={handleTitleChange}
              onDescriptionChange={handleDescriptionChange}
              onAiInstructionsChange={handleAiInstructionsChange}
              isRequired={schema.required?.includes(key) || false}
              isDraggedOver={dragOverItem === key}
              isDragged={draggedItem === key}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            >
              {children(key, propertySchema, propertyId)}
            </FieldBuilder>
          )
        })}
    </div>
  )
}
