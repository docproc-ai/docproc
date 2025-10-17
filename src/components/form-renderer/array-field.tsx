'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Item, ItemContent, ItemTitle, ItemActions, ItemGroup } from '@/components/ui/item'
import { cn } from '@/lib/utils'
import type { FormFieldProps } from './types'
import type { JsonSchema } from '../schema-builder/types'
import { StringField } from './string-field'
import { NumberField } from './number-field'
import { BooleanField } from './boolean-field'
import { ObjectField } from './object-field'

// Forward declaration to avoid circular dependency
function FormField({
  name,
  schema,
  value,
  onChange,
  required,
  isArrayItem = false,
  isStreaming = false,
}: {
  name: string
  schema: JsonSchema
  value: any
  onChange: (value: any) => void
  required?: boolean
  isArrayItem?: boolean
  isStreaming?: boolean
}) {
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

function SpreadsheetCellInput({
  schema,
  value,
  onChange,
  disabled = false,
}: {
  schema: JsonSchema
  value: any
  onChange: (value: any) => void
  disabled?: boolean
}) {
  const fieldType = Array.isArray(schema.type) ? schema.type[0] : schema.type
  const inputClasses =
    'w-full h-full bg-transparent border-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 rounded-none px-2 py-1'

  switch (fieldType) {
    case 'number':
    case 'integer':
      return (
        <Input
          type="number"
          value={value ?? ''}
          onChange={(e) =>
            onChange(
              e.target.value === ''
                ? undefined
                : fieldType === 'integer'
                  ? Number.parseInt(e.target.value)
                  : Number.parseFloat(e.target.value),
            )
          }
          onWheel={(e) => e.currentTarget.blur()}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
            }
          }}
          className={cn(
            inputClasses,
            '[-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          )}
          disabled={disabled}
        />
      )
    case 'boolean':
      return (
        <div className="flex h-full items-center justify-center">
          <Checkbox checked={!!value} onCheckedChange={onChange} disabled={disabled} />
        </div>
      )
    case 'string':
      if (schema.format === 'date') {
        return (
          <Input
            type={disabled ? 'text' : 'date'}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className={cn(inputClasses, 'relative')}
            disabled={disabled}
          />
        )
      }
      return (
        <Input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
          disabled={disabled}
        />
      )
    default:
      return (
        <Input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
          disabled={disabled}
        />
      )
  }
}

function ArrayTableField({
  name,
  schema,
  value,
  onChange,
  required,
  isStreaming = false,
}: {
  name: string
  schema: JsonSchema
  value: any[]
  onChange: (value: any[]) => void
  required?: boolean
  isStreaming?: boolean
}) {
  const arrayValue = value || []

  const handleAddRow = () => {
    const itemsSchema = schema.items || {}
    let newItem: any
    if (itemsSchema.type === 'object') {
      newItem = Object.entries(itemsSchema.properties || {}).reduce(
        (acc, [key, propSchema]) => {
          acc[key] = propSchema.default !== undefined ? propSchema.default : undefined
          return acc
        },
        {} as Record<string, any>,
      )
    } else {
      newItem = itemsSchema.default !== undefined ? itemsSchema.default : ''
    }
    onChange([...arrayValue, newItem])
  }

  const handleRemoveRow = (index: number) => {
    const newArray = arrayValue.filter((_, i) => i !== index)
    onChange(newArray)
  }

  const handleCellChange = (rowIndex: number, columnKey: string | null, newValue: any) => {
    const newArray = [...arrayValue]
    if (columnKey) {
      newArray[rowIndex] = { ...newArray[rowIndex], [columnKey]: newValue }
    } else {
      newArray[rowIndex] = newValue
    }
    onChange(newArray)
  }

  const itemsSchema = schema.items || { type: 'string' }
  const isObjectArray = itemsSchema.type === 'object' && itemsSchema.properties
  const headers = isObjectArray
    ? Object.keys(itemsSchema.properties || {})
    : [itemsSchema.title || 'Value']

  return (
    <Field>
      <FieldLabel>
        {schema.title || name}
        {required && <span className="ml-1 text-red-500">*</span>}
      </FieldLabel>
      {schema.description && (
        <FieldDescription>{schema.description}</FieldDescription>
      )}
      <div className="border-border overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {headers.map((header) => (
                <TableHead key={header} className="px-2 py-2 whitespace-nowrap">
                  {isObjectArray ? itemsSchema.properties?.[header]?.title || header : header}
                </TableHead>
              ))}
              <TableHead className="w-[50px] px-2 py-2 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {arrayValue.map((item, rowIndex) => (
              <TableRow key={rowIndex}>
                {headers.map((headerKey) => {
                  const cellSchema = isObjectArray
                    ? itemsSchema.properties?.[headerKey] || {}
                    : itemsSchema
                  const cellValue = isObjectArray ? item[headerKey] : item
                  const columnKey = isObjectArray ? headerKey : null
                  return (
                    <TableCell key={headerKey} className="h-10 p-0">
                      <SpreadsheetCellInput
                        schema={cellSchema}
                        value={cellValue}
                        onChange={(newValue) => handleCellChange(rowIndex, columnKey, newValue)}
                        disabled={isStreaming}
                      />
                    </TableCell>
                  )
                })}
                <TableCell className="px-2 py-0 text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveRow(rowIndex)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {!isStreaming && (
        <Button type="button" variant="outline" size="sm" onClick={handleAddRow}>
          <Plus className="h-4 w-4" />
          Add Row
        </Button>
      )}
    </Field>
  )
}

export function ArrayField({
  name,
  schema,
  value,
  onChange,
  required,
  isStreaming,
}: FormFieldProps) {
  const [expandedArrayItems, setExpandedArrayItems] = useState<Record<string, boolean>>({})

  if (schema.type !== 'array') return null

  const toggleArrayItem = (itemKey: string) => {
    setExpandedArrayItems((prev) => {
      const currentState = prev[itemKey] ?? true // Default to expanded if undefined
      return {
        ...prev,
        [itemKey]: !currentState,
      }
    })
  }

  if (schema['ui:widget'] === 'table') {
    return (
      <ArrayTableField
        name={name}
        schema={schema}
        value={value}
        onChange={onChange}
        required={required}
        isStreaming={isStreaming}
      />
    )
  }

  const arrayValue = value || []

  const allExpanded = arrayValue.every((_: any, index: number) => {
    const itemKey = `${name}-${index}`
    return expandedArrayItems[itemKey] !== false
  })

  const toggleAll = () => {
    const newState: Record<string, boolean> = {}
    arrayValue.forEach((_: any, index: number) => {
      const itemKey = `${name}-${index}`
      newState[itemKey] = !allExpanded
    })
    setExpandedArrayItems(newState)
  }

  return (
    <Field>
      <div className="flex items-center justify-between">
        <div>
          <FieldLabel>
            {schema.title || name}
            {required && <span className="ml-1 text-red-500">*</span>}
          </FieldLabel>
          {schema.description && (
            <FieldDescription>{schema.description}</FieldDescription>
          )}
        </div>
        <div className="flex items-center gap-2">
          {arrayValue.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleAll}
            >
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const newIndex = arrayValue.length
              const itemKey = `${name}-${newIndex}`
              setExpandedArrayItems(prev => ({ ...prev, [itemKey]: true }))
              onChange([...arrayValue, schema.items?.default ?? ''])
            }}
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>
      <ItemGroup>
        {arrayValue.map((item: any, index: number) => {
          const itemKey = `${name}-${index}`
          const isExpanded = expandedArrayItems[itemKey] !== false

          // Generate display text from template or value
          const displayText = (() => {
            const itemsSchema = schema.items || { type: 'string' }
            const isObjectItem = itemsSchema.type === 'object'
            const template = itemsSchema['ui:displayTemplate']

            // For object items with template, use template
            if (isObjectItem && template && typeof item === 'object') {
              const result = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, fieldName) => {
                const value = item[fieldName]
                return value !== undefined && value !== null && value !== '' ? String(value) : match
              })
              return result || `${schema.title || name}[${index}]`
            }

            // For non-object items, show the value directly
            if (!isObjectItem && item !== undefined && item !== null && item !== '') {
              return String(item)
            }

            // Fallback to index
            return `${schema.title || name}[${index}]`
          })()

          return (
            <Collapsible key={index} open={isExpanded} onOpenChange={() => toggleArrayItem(itemKey)}>
              <Item variant="outline" className="flex-col !flex-nowrap">
                <CollapsibleTrigger asChild>
                  <div className="flex w-full cursor-pointer items-center justify-between">
                    <ItemContent>
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <ItemTitle>
                          {displayText}
                        </ItemTitle>
                      </div>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          const newArray = arrayValue.filter((_: any, i: number) => i !== index)
                          onChange(newArray)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </ItemActions>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="w-full pt-4">
                  <FormField
                    name={`${name}[${index}]`}
                    schema={schema.items || { type: 'string' }}
                    value={item}
                    onChange={(newValue: any) => {
                      const newArray = [...arrayValue]
                      newArray[index] = newValue
                      onChange(newArray)
                    }}
                    isArrayItem={true}
                    isStreaming={isStreaming}
                  />
                </CollapsibleContent>
              </Item>
            </Collapsible>
          )
        })}
      </ItemGroup>
    </Field>
  )
}
